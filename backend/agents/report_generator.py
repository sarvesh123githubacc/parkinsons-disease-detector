"""
Report Generator Agent

Assembles the complete diagnostic report from all previous agent outputs
stored in the pipeline context.
"""

import os
from datetime import datetime, timezone
from typing import Any, Dict, List

from .base import BaseAgent


class ReportGeneratorAgent(BaseAgent):
    """
    Assembles the final report from the shared pipeline context.

    Context input (all previous agent outputs merged):
        session_id (str)
        audio_quality (dict)     - from AudioValidatorAgent
        features_raw (dict)      - from FeatureExtractorAgent
        features_scaled (list)   - from FeatureExtractorAgent
        feature_names (list)     - from FeatureExtractorAgent
        model_results (dict)     - from MLEnsembleAgent
        primary_prediction (int)
        primary_probability (float)
        ensemble_vote (int)
        ensemble_probability (float)
        models_agreeing (int)
        risk_tier (str)          - from InterpreterAgent
        confidence_pct (float)
        risk_label (str)
        plain_summary (str)
        anomalous_features (list)
        disease_overview (str)   - from KnowledgeRetrievalAgent
        relevant_biomarker_info (list)
        risk_tier_summary (str)
        next_steps (list)
        lifestyle_tips (list)
        disclaimer (str)

    Output:
        Complete report dict.
    """

    def __init__(self):
        super().__init__("report_generator")

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        session_id: str = context.get("session_id", "unknown")
        timestamp: str = datetime.now(timezone.utc).isoformat()

        risk_tier: str = context.get("risk_tier", "low")
        primary_prediction: int = context.get("primary_prediction", 0)
        ensemble_vote: int = context.get("ensemble_vote", 0)
        confidence_pct: float = context.get("confidence_pct", 0.0)
        risk_label: str = context.get("risk_label", "Low Risk")
        plain_summary: str = context.get("plain_summary", "")

        # Verdict string
        if primary_prediction == 1 and ensemble_vote == 1:
            verdict = (
                f"Parkinson's Disease Indicators Detected — {risk_label} "
                f"({confidence_pct:.1f}% probability)"
            )
        elif primary_prediction == 0 and ensemble_vote == 0:
            verdict = (
                f"No Significant Parkinson's Indicators — {risk_label} "
                f"({confidence_pct:.1f}% probability)"
            )
        else:
            verdict = (
                f"Inconclusive — Models Disagree — {risk_label} "
                f"({confidence_pct:.1f}% probability)"
            )

        report: Dict[str, Any] = {
            "session_id": session_id,
            "timestamp": timestamp,
            "verdict": verdict,
            "risk_tier": risk_tier,
            "risk_label": risk_label,
            "confidence_pct": confidence_pct,
            "primary_prediction": primary_prediction,
            "primary_prediction_label": "Parkinson's" if primary_prediction == 1 else "Healthy",
            "ensemble_vote": ensemble_vote,
            "ensemble_vote_label": "Parkinson's" if ensemble_vote == 1 else "Healthy",
            "models_agreeing": context.get("models_agreeing", 0),
            "plain_summary": plain_summary,
            "audio_quality": {
                "valid": context.get("valid", True),
                "issues": context.get("issues", []),
                "snr_db": context.get("snr_db", 0.0),
                "duration_s": context.get("duration_s", 0.0),
                "sample_rate": context.get("sample_rate", 22050),
                "rms_energy": context.get("rms_energy", 0.0),
            },
            "features": {
                "raw": context.get("features_raw", {}),
                "feature_names": context.get("feature_names", []),
            },
            "model_results": context.get("model_results", {}),
            "interpretation": {
                "risk_tier": risk_tier,
                "risk_label": risk_label,
                "confidence_pct": confidence_pct,
                "primary_probability": context.get("primary_probability", 0.0),
                "ensemble_probability": context.get("ensemble_probability", 0.0),
                "anomalous_features": context.get("anomalous_features", []),
            },
            "knowledge": {
                "disease_overview": context.get("disease_overview", ""),
                "relevant_biomarker_info": context.get("relevant_biomarker_info", []),
                "risk_tier_summary": context.get("risk_tier_summary", ""),
            },
            "next_steps": context.get("next_steps", []),
            "lifestyle_tips": context.get("lifestyle_tips", []),
            "disclaimer": context.get("disclaimer", ""),
        }

        return {"report": report}
