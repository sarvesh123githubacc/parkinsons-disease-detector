"""
Agent Pipeline Orchestrator

Runs the 6-step agent pipeline and streams SSE-formatted JSON events
for real-time frontend updates.

Pipeline steps:
    1. AudioValidatorAgent   — validate audio quality
    2. FeatureExtractorAgent — extract 22 voice biomarkers
    3. MLEnsembleAgent       — run 7 model inference
    4. InterpreterAgent      — interpret results into risk tier
    5. KnowledgeRetrievalAgent — retrieve medical context
    6. ReportGeneratorAgent  — assemble final report
"""

import asyncio
import json
from typing import Any, AsyncGenerator, Dict

from agents.audio_validator import AudioValidatorAgent
from agents.feature_extractor import FeatureExtractorAgent
from agents.ml_ensemble import MLEnsembleAgent
from agents.interpreter import InterpreterAgent
from agents.knowledge_retrieval import KnowledgeRetrievalAgent
from agents.report_generator import ReportGeneratorAgent

# ── Step definitions ──────────────────────────────────────────────────────────
_PIPELINE_STEPS = [
    {
        "agent_class": AudioValidatorAgent,
        "key": "audio_validator",
        "label": "Validating Audio Quality",
        "context_key_map": {
            "valid": "valid",
            "issues": "issues",
            "snr_db": "snr_db",
            "duration_s": "duration_s",
            "sample_rate": "sample_rate",
            "rms_energy": "rms_energy",
            "clipped_fraction": "clipped_fraction",
            "silence_ratio": "silence_ratio",
        },
    },
    {
        "agent_class": FeatureExtractorAgent,
        "key": "feature_extractor",
        "label": "Extracting Voice Biomarkers",
        "context_key_map": {
            "features_raw": "features_raw",
            "features_scaled": "features_scaled",
            "feature_names": "feature_names",
        },
    },
    {
        "agent_class": MLEnsembleAgent,
        "key": "ml_ensemble",
        "label": "Running ML Ensemble Analysis",
        "context_key_map": {
            "model_results": "model_results",
            "primary_prediction": "primary_prediction",
            "primary_probability": "primary_probability",
            "ensemble_vote": "ensemble_vote",
            "ensemble_probability": "ensemble_probability",
            "models_agreeing": "models_agreeing",
        },
    },
    {
        "agent_class": InterpreterAgent,
        "key": "interpreter",
        "label": "Interpreting Clinical Significance",
        "context_key_map": {
            "risk_tier": "risk_tier",
            "confidence_pct": "confidence_pct",
            "risk_label": "risk_label",
            "plain_summary": "plain_summary",
            "anomalous_features": "anomalous_features",
            "combined_probability": "combined_probability",
        },
    },
    {
        "agent_class": KnowledgeRetrievalAgent,
        "key": "knowledge_retrieval",
        "label": "Retrieving Medical Knowledge",
        "context_key_map": {
            "disease_overview": "disease_overview",
            "relevant_biomarker_info": "relevant_biomarker_info",
            "risk_tier_summary": "risk_tier_summary",
            "next_steps": "next_steps",
            "lifestyle_tips": "lifestyle_tips",
            "disclaimer": "disclaimer",
        },
    },
    {
        "agent_class": ReportGeneratorAgent,
        "key": "report_generator",
        "label": "Generating Final Report",
        "context_key_map": {
            "report": "report",
        },
    },
]


def _sse(data: Dict[str, Any]) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


class AgentPipeline:
    """
    Runs the 6-step agent pipeline and yields SSE-formatted JSON strings
    for streaming to the client.
    """

    TOTAL_STEPS = len(_PIPELINE_STEPS)

    def __init__(self, session_id: str, audio_path: str):
        self.session_id = session_id
        self.audio_path = audio_path
        self.context: Dict[str, Any] = {
            "session_id": session_id,
            "audio_path": audio_path,
        }

    async def run_stream(self) -> AsyncGenerator[str, None]:
        """
        Async generator that yields SSE event strings.

        Events emitted:
            agent_start     — before each agent runs
            agent_done      — after each agent completes successfully
            agent_error     — if an agent fails (pipeline stops)
            quality_failed  — if audio validation fails (pipeline stops)
            pipeline_complete — with the full report when all steps succeed
        """
        loop = asyncio.get_event_loop()

        for step_index, step_def in enumerate(_PIPELINE_STEPS, start=1):
            agent_key: str = step_def["key"]
            label: str = step_def["label"]

            # ── Emit start event ──────────────────────────────────────────────
            yield _sse(
                {
                    "type": "agent_start",
                    "agent": agent_key,
                    "step": step_index,
                    "total": self.TOTAL_STEPS,
                    "label": label,
                }
            )

            # ── Run agent in thread pool (CPU-bound) ──────────────────────────
            agent_instance = step_def["agent_class"]()

            result = await loop.run_in_executor(
                None, agent_instance.run, self.context
            )

            if not result.success:
                yield _sse(
                    {
                        "type": "agent_error",
                        "agent": agent_key,
                        "step": step_index,
                        "message": result.message,
                        "duration_ms": result.duration_ms,
                    }
                )
                return  # Stop pipeline on error

            # ── Merge agent output into shared context ────────────────────────
            for output_key, ctx_key in step_def["context_key_map"].items():
                if output_key in result.data:
                    self.context[ctx_key] = result.data[output_key]

            # ── Special handling: audio quality gate ──────────────────────────
            if agent_key == "audio_validator" and not result.data.get("valid", True):
                yield _sse(
                    {
                        "type": "agent_done",
                        "agent": agent_key,
                        "step": step_index,
                        "data": result.data,
                        "duration_ms": result.duration_ms,
                    }
                )
                yield _sse(
                    {
                        "type": "quality_failed",
                        "issues": result.data.get("issues", []),
                        "snr_db": result.data.get("snr_db", 0),
                        "duration_s": result.data.get("duration_s", 0),
                    }
                )
                return  # Stop pipeline; prompt re-record

            # ── Emit done event ───────────────────────────────────────────────
            yield _sse(
                {
                    "type": "agent_done",
                    "agent": agent_key,
                    "step": step_index,
                    "data": result.data,
                    "duration_ms": result.duration_ms,
                }
            )

        # ── All steps complete — emit final report ────────────────────────────
        report = self.context.get("report", {})
        yield _sse(
            {
                "type": "pipeline_complete",
                "report": report,
            }
        )
