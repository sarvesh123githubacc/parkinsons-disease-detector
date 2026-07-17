"""
FastAPI Application Entry Point

Parkinson's Disease Voice Screening API — Backend
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import analysis, health, knowledge

app = FastAPI(
    title="Parkinson's Detection API",
    description=(
        "Agentic voice-based Parkinson's disease screening system. "
        "Upload a sustained 'aah' vowel recording and receive a full "
        "acoustic biomarker analysis with risk stratification."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # Next.js dev server
        "http://localhost:4173",   # Vite preview
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(analysis.router, prefix="/api/v1/analysis", tags=["Analysis"])
app.include_router(health.router, prefix="/api/v1/health", tags=["Health"])
app.include_router(knowledge.router, prefix="/api/v1/knowledge", tags=["Knowledge"])


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Parkinson's Detection API",
        "version": "1.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info",
    )
