"""
Interpreter Agent

Interprets model output into a clinically meaningful risk tier, confidence
percentage, plain English summary, and anomalous feature analysis.

Risk tiers:
    low       : probability < 0.30
    moderate  : 0.30 ≤ probability < 0.60
    high      : 0.60 ≤ probability < 0.85
    critical  : probability ≥ 0.85
"""

import json
import os
from typing import Any, Dict, List, Optional

import numpy as np

from .base import BaseAgent

_MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
_FEATURE_STATS_PATH = os.path.join(_MODELS_DIR, "feature_stats.json")

# ── Knowledge base biomarker descriptions (short) ────────────────────────────
_FEATURE_DESCRIPTIONS: Dict[str, str] = {
    "MDVP:Fo": "Average vocal fundamental frequency (average pitch)",
    "MDVP:Fhi": "Maximum fundamental frequency (highest pitch recorded)",
    "MDVP:Flo": "Minimum fundamental frequency (lowest pitch recorded)",
    "MDVP:Jitter(%)": "Cycle-to-cycle pitch variation as a percentage",
    "MDVP:Jitter(Abs)": "Absolute cycle-to-cycle pitch variation in microseconds",
    "MDVP:RAP": "Relative average perturbation of vocal period (3-point smoothing)",
    "MDVP:PPQ": "Pitch period perturbation quotient (5-point smoothing)",
    "Jitter:DDP": "Average absolute difference of consecutive period differences",
    "MDVP:Shimmer": "Cycle-to-cycle amplitude variation (percentage)",
    "MDVP:Shimmer(dB)": "Cycle-to-cycle amplitude variation in decibels",
    "Shimmer:APQ3": "Amplitude perturbation quotient over 3-period window",
    "Shimmer:APQ5": "Amplitude perturbation quotient over 5-period window",
    "MDVP:APQ": "Amplitude perturbation quotient over 11-period window",
    "Shimmer:DDA": "Average absolute difference of consecutive amplitude differences",
    "NHR": "Noise-to-harmonics ratio (breathiness indicator)",
    "HNR": "Harmonics-to-noise ratio (voice clarity measure, higher = cleaner)",
    "RPDE": "Recurrence period density entropy (nonlinear periodicity measure)",
    "DFA": "Detrended fluctuation analysis scaling exponent",
    "spread1": "Nonlinear fundamental frequency variation — primary spread",
    "spread2": "Nonlinear fundamental frequency variation — secondary spread",
    "D2": "Correlation dimension (signal complexity measure)",
    "PPE": "Pitch period entropy (pitch sequence unpredictability)",
}

# Features where LOWER values are more abnormal (inverse z-score for ranking)
_LOWER_IS_ABNORMAL = {"MDVP:Fo", "MDVP:Fhi", "MDVP:Flo", "HNR"}


def _load_feature_stats() -> Optional[Dict[str, Any]]:
    """Load training feature statistics for z-score computation."""
    if os.path.isfile(_FEATURE_STATS_PATH):
        with open(_FEATURE_STATS_PATH, "r") as f:
            return json.load(f)
    return None


class InterpreterAgent(BaseAgent):
    """
    Interprets ensemble predictions into a clinically meaningful output.

    Context input:
        primary_probability (float): PD probability from primary model.
        ensemble_probability (float): Mean probability across all models.
        features_raw (dict): Raw feature values.
        features_scaled (list): Scaled feature values.
        feature_names (list): Ordered feature names.

    Output:
        risk_tier (str): one of low / moderate / high / critical
        confidence_pct (float): probability * 100
        risk_label (str): Human-readable risk label.
        plain_summary (str): 1-2 sentence plain English summary.
        anomalous_features (list[dict]): Top 5 most anomalous features.
    """

    _TIER_LABELS = {
        "low": "Low Risk",
        "moderate": "Moderate Risk",
        "high": "High Risk",
        "critical": "Critical Risk",
    }

    _SUMMARIES = {
        "low": (
            "Your voice analysis result shows a low probability pattern of Parkinson's disease. "
            "Most acoustic biomarkers fall within or near normal ranges for healthy adults. "
            "No immediate clinical action is required, though continued monitoring is always advisable."
        ),
        "moderate": (
            "Your voice analysis has identified a moderate probability pattern that overlaps with "
            "early Parkinson's disease characteristics. Several acoustic biomarkers deviate from "
            "healthy norms. A neurological evaluation within the next few months is advisable to "
            "either rule out or confirm Parkinson's disease at an early, more treatable stage."
        ),
        "high": (
            "Your voice analysis shows a high probability pattern strongly consistent with "
            "Parkinsonian vocal dysfunction. Multiple independent biomarkers — including pitch "
            "stability, amplitude variation, and nonlinear voice dynamics — are significantly "
            "outside healthy ranges. A prompt neurological evaluation is strongly recommended."
        ),
        "critical": (
            "Your voice analysis has detected a critical-level probability pattern with acoustic "
            "biomarkers highly characteristic of significant Parkinsonian vocal dysfunction. "
            "The degree of abnormality across multiple voice measures warrants immediate neurological "
            "attention. Please contact a neurologist or movement disorders specialist as soon as possible."
        ),
    }

    def __init__(self):
        super().__init__("interpreter")
        self._feature_stats: Optional[Dict[str, Any]] = None

    def _get_feature_stats(self) -> Optional[Dict[str, Any]]:
        if self._feature_stats is None:
            self._feature_stats = _load_feature_stats()
        return self._feature_stats

    def _classify_risk_tier(self, probability: float) -> str:
        if probability < 0.30:
            return "low"
        elif probability < 0.60:
            return "moderate"
        elif probability < 0.85:
            return "high"
        else:
            return "critical"

    def _compute_anomalous_features(
        self,
        features_raw: Dict[str, float],
        feature_names: List[str],
    ) -> List[Dict[str, Any]]:
        """Compute z-scores against training statistics and return top 5 anomalous features."""
        stats = self._get_feature_stats()
        if stats is None:
            return []

        scored: List[Dict[str, Any]] = []

        for name in feature_names:
            if name not in features_raw or name not in stats:
                continue

            value = float(features_raw[name])
            mean = float(stats[name]["mean"])
            std = float(stats[name]["std"])

            if std < 1e-9:
                continue

            z = (value - mean) / std

            # For features where lower = more abnormal, flip the z-score for ranking
            abs_z = abs(z)

            direction = "above" if z > 0 else "below"

            scored.append(
                {
                    "name": name,
                    "z_score": round(z, 4),
                    "abs_z_score": round(abs_z, 4),
                    "direction": direction,
                    "value": round(value, 8),
                    "mean": round(mean, 8),
                    "std": round(std, 8),
                    "description": _FEATURE_DESCRIPTIONS.get(name, name),
                }
            )

        # Sort by absolute z-score descending; take top 5
        scored.sort(key=lambda x: x["abs_z_score"], reverse=True)
        top5 = scored[:5]

        # Remove internal abs_z_score from output
        for item in top5:
            item.pop("abs_z_score", None)

        return top5

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        primary_probability: float = float(context.get("primary_probability", 0.0))
        ensemble_probability: float = float(context.get("ensemble_probability", primary_probability))

        # Use ensemble probability as the primary signal for risk tier
        combined_probability = (primary_probability * 0.6) + (ensemble_probability * 0.4)

        features_raw: Dict[str, float] = context.get("features_raw", {})
        feature_names: List[str] = context.get(
            "feature_names",
            list(features_raw.keys()),
        )

        risk_tier = self._classify_risk_tier(combined_probability)
        confidence_pct = round(combined_probability * 100.0, 2)
        risk_label = self._TIER_LABELS[risk_tier]
        plain_summary = self._SUMMARIES[risk_tier]

        anomalous_features = self._compute_anomalous_features(features_raw, feature_names)

        return {
            "risk_tier": risk_tier,
            "confidence_pct": confidence_pct,
            "risk_label": risk_label,
            "plain_summary": plain_summary,
            "anomalous_features": anomalous_features,
            "primary_probability": round(primary_probability, 6),
            "ensemble_probability": round(ensemble_probability, 6),
            "combined_probability": round(combined_probability, 6),
        }
