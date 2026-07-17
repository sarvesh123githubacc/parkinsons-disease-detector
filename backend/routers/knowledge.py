"""
Knowledge Router

Endpoints:
    GET /api/v1/knowledge/biomarkers              — all 22 biomarker definitions
    GET /api/v1/knowledge/biomarkers/{name}       — single biomarker (URL-encoded)
    GET /api/v1/knowledge/parkinsons              — disease overview
    GET /api/v1/knowledge/next-steps/{risk_tier}  — risk tier info + next steps
"""

import json
import os
import urllib.parse
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

router = APIRouter()

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
_KB_PATH = os.path.join(_DATA_DIR, "knowledge_base.json")

_KB_CACHE: Dict[str, Any] = {}


def _load_kb() -> Dict[str, Any]:
    global _KB_CACHE
    if not _KB_CACHE:
        with open(_KB_PATH, "r", encoding="utf-8") as f:
            _KB_CACHE = json.load(f)
    return _KB_CACHE


@router.get("/biomarkers")
async def get_all_biomarkers():
    """Return all 22 biomarker definitions from the knowledge base."""
    kb = _load_kb()
    return kb.get("biomarkers", {})


@router.get("/biomarkers/{name:path}")
async def get_biomarker(name: str):
    """
    Return information for a single biomarker by name.

    The name should be URL-encoded if it contains special characters,
    e.g. 'MDVP%3AFo' for 'MDVP:Fo'.

    Raises:
        404: If the biomarker name is not found in the knowledge base.
    """
    kb = _load_kb()
    biomarkers = kb.get("biomarkers", {})

    # Try exact match first
    if name in biomarkers:
        return {name: biomarkers[name]}

    # Try URL-decoded match
    decoded_name = urllib.parse.unquote(name)
    if decoded_name in biomarkers:
        return {decoded_name: biomarkers[decoded_name]}

    raise HTTPException(
        status_code=404,
        detail=f"Biomarker '{decoded_name}' not found. "
               f"Available biomarkers: {list(biomarkers.keys())}",
    )


@router.get("/parkinsons")
async def get_disease_overview():
    """Return the disease overview section of the knowledge base."""
    kb = _load_kb()
    overview = kb.get("disease_overview", {})
    if not overview:
        raise HTTPException(status_code=404, detail="Disease overview not found in knowledge base.")
    return overview


@router.get("/next-steps/{risk_tier}")
async def get_next_steps(risk_tier: str):
    """
    Return risk tier guidance including summary, next steps, and lifestyle tips.

    Args:
        risk_tier: one of low, moderate, high, critical

    Raises:
        400: If risk_tier is not one of the valid values.
        404: If the risk tier data is missing from the knowledge base.
    """
    valid_tiers = {"low", "moderate", "high", "critical"}
    if risk_tier.lower() not in valid_tiers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid risk tier '{risk_tier}'. Valid values: {sorted(valid_tiers)}",
        )

    kb = _load_kb()
    risk_tiers = kb.get("risk_tiers", {})
    tier_data = risk_tiers.get(risk_tier.lower())

    if tier_data is None:
        raise HTTPException(
            status_code=404,
            detail=f"Risk tier '{risk_tier}' not found in knowledge base.",
        )

    return {
        "risk_tier": risk_tier.lower(),
        **tier_data,
    }
