"""
Analysis Router

Endpoints:
    POST /api/v1/analysis/upload          — upload audio file, get session_id
    GET  /api/v1/analysis/stream/{sid}    — SSE stream of agent pipeline
    GET  /api/v1/analysis/report/{sid}    — final report JSON
    GET  /api/v1/analysis/features/{sid}  — raw feature dict
    GET  /api/v1/analysis/models/{sid}    — per-model predictions
"""

import os
import tempfile
import uuid
from typing import Any, Dict

import aiofiles
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from orchestrator import AgentPipeline

router = APIRouter()

# ── In-memory session store ────────────────────────────────────────────────────
# Keyed by session_id; each value holds the audio path and (eventually) the report.
_SESSIONS: Dict[str, Dict[str, Any]] = {}

ALLOWED_EXTENSIONS = {".wav", ".mp3", ".ogg", ".m4a", ".webm", ".flac"}
MAX_FILE_SIZE_MB = 50


@router.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    """
    Accept a multipart audio upload and persist it to a temp file.

    Returns:
        session_id (str): Unique identifier for this analysis session.
        filename (str): Original filename.
        size_bytes (int): File size in bytes.
    """
    # Validate extension
    _, ext = os.path.splitext(file.filename or "audio.wav")
    ext = ext.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    session_id = str(uuid.uuid4())

    # Write to a persistent temp file (won't auto-delete)
    tmp_dir = tempfile.gettempdir()
    audio_path = os.path.join(tmp_dir, f"pd_audio_{session_id}{ext}")

    content = await file.read()
    size_bytes = len(content)

    if size_bytes > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {MAX_FILE_SIZE_MB} MB.",
        )

    async with aiofiles.open(audio_path, "wb") as f:
        await f.write(content)

    _SESSIONS[session_id] = {
        "audio_path": audio_path,
        "filename": file.filename,
        "size_bytes": size_bytes,
        "report": None,
        "features_raw": None,
        "model_results": None,
    }

    return {
        "session_id": session_id,
        "filename": file.filename,
        "size_bytes": size_bytes,
    }


@router.get("/stream/{session_id}")
async def stream_analysis(session_id: str):
    """
    Stream the agent pipeline as Server-Sent Events (SSE).

    Emits one JSON event per agent step. On completion, emits pipeline_complete
    with the full report. The frontend should listen on this endpoint after
    calling /upload.
    """
    session = _SESSIONS.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    audio_path: str = session["audio_path"]

    async def event_generator():
        pipeline = AgentPipeline(session_id=session_id, audio_path=audio_path)
        async for event_str in pipeline.run_stream():
            # event_str is already formatted as "data: {...}\n\n"
            # EventSourceResponse expects plain data strings
            import json
            # Strip the "data: " prefix and trailing newlines for SSE library
            raw = event_str.strip()
            if raw.startswith("data: "):
                raw = raw[6:]
            event_data = json.loads(raw)

            event_type = event_data.get("type", "message")

            # Cache relevant outputs for subsequent GET endpoints
            if event_type == "pipeline_complete":
                session["report"] = event_data.get("report")
                # Clean up temp audio file
                try:
                    if os.path.isfile(audio_path):
                        os.remove(audio_path)
                except OSError:
                    pass

            if event_type == "agent_done":
                agent = event_data.get("agent")
                data = event_data.get("data", {})
                if agent == "feature_extractor":
                    session["features_raw"] = data.get("features_raw")
                elif agent == "ml_ensemble":
                    session["model_results"] = data.get("model_results")

            yield {"data": json.dumps(event_data)}

    return EventSourceResponse(event_generator())


@router.get("/report/{session_id}")
async def get_report(session_id: str):
    """Return the final report JSON for a completed session."""
    session = _SESSIONS.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    report = session.get("report")
    if report is None:
        raise HTTPException(
            status_code=404,
            detail="Report not yet generated. Stream the analysis first.",
        )

    return JSONResponse(content=report)


@router.get("/features/{session_id}")
async def get_features(session_id: str):
    """Return the raw feature dict for a session."""
    session = _SESSIONS.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    features = session.get("features_raw")
    if features is None:
        raise HTTPException(
            status_code=404,
            detail="Features not yet extracted. Stream the analysis first.",
        )

    return {"session_id": session_id, "features_raw": features}


@router.get("/models/{session_id}")
async def get_model_results(session_id: str):
    """Return per-model predictions and probabilities for a session."""
    session = _SESSIONS.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    model_results = session.get("model_results")
    if model_results is None:
        raise HTTPException(
            status_code=404,
            detail="Model results not yet available. Stream the analysis first.",
        )

    return {"session_id": session_id, "model_results": model_results}
