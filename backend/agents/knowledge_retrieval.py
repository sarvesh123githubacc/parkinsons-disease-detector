"""
Knowledge Retrieval Agent

Retrieves relevant medical knowledge from the knowledge base JSON file,
tailored to the patient's risk tier and anomalous features.
"""

import json
import os
from typing import Any, Dict, List

from .base import BaseAgent

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
_KB_PATH = os.path.join(_DATA_DIR, "knowledge_base.json")

# Module-level cache
_KNOWLEDGE_BASE: Dict[str, Any] = {}


def _load_knowledge_base() -> Dict[str, Any]:
    global _KNOWLEDGE_BASE
    if not _KNOWLEDGE_BASE:
        with open(_KB_PATH, "r", encoding="utf-8") as f:
            _KNOWLEDGE_BASE = json.load(f)
    return _KNOWLEDGE_BASE


class KnowledgeRetrievalAgent(BaseAgent):
    """
    Retrieves disease overview, biomarker information for the top anomalous
    features, risk tier guidance, and the medical disclaimer.

    Context input:
        risk_tier (str): one of low / moderate / high / critical
        anomalous_features (list[dict]): List of anomalous feature dicts from Interpreter.

    Output:
        disease_overview (str): Combined disease overview text.
        relevant_biomarker_info (list[dict]): Knowledge for each anomalous feature.
        risk_tier_summary (str): Summary for the detected risk tier.
        next_steps (list[str]): Actionable next steps.
        lifestyle_tips (list[str]): Lifestyle recommendations.
        disclaimer (str): Medical disclaimer.
    """

    def __init__(self):
        super().__init__("knowledge_retrieval")

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        risk_tier: str = context.get("risk_tier", "low")
        anomalous_features: List[Dict[str, Any]] = context.get("anomalous_features", [])

        kb = _load_knowledge_base()

        # ── Disease overview ─────────────────────────────────────────────────
        overview_section = kb.get("disease_overview", {})
        disease_overview = overview_section.get("content", "")

        # ── Biomarker info for anomalous features ────────────────────────────
        biomarkers_kb = kb.get("biomarkers", {})
        relevant_biomarker_info: List[Dict[str, Any]] = []

        for feat in anomalous_features:
            feat_name = feat.get("name", "")
            bio_info = biomarkers_kb.get(feat_name, {})
            if bio_info:
                relevant_biomarker_info.append(
                    {
                        "name": feat_name,
                        "full_name": bio_info.get("name", feat_name),
                        "description": bio_info.get("description", ""),
                        "normal_range": bio_info.get("normal_range", ""),
                        "abnormal_sign": bio_info.get("abnormal_sign", ""),
                        "patient_value": feat.get("value"),
                        "z_score": feat.get("z_score"),
                        "direction": feat.get("direction"),
                    }
                )

        # ── Risk tier information ─────────────────────────────────────────────
        risk_tiers_kb = kb.get("risk_tiers", {})
        tier_info = risk_tiers_kb.get(risk_tier, {})

        risk_tier_summary = tier_info.get("summary", "")
        next_steps = tier_info.get("next_steps", [])
        lifestyle_tips = tier_info.get("lifestyle_tips", [])

        # ── Disclaimer ────────────────────────────────────────────────────────
        disclaimer = kb.get("disclaimer", "")

        return {
            "disease_overview": disease_overview,
            "relevant_biomarker_info": relevant_biomarker_info,
            "risk_tier_summary": risk_tier_summary,
            "next_steps": next_steps,
            "lifestyle_tips": lifestyle_tips,
            "disclaimer": disclaimer,
        }
