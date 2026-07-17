"""
Health Router

Endpoints:
    GET /api/v1/health          — liveness check with model status
    GET /api/v1/health/models   — detailed model metrics from training
"""

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

router = APIRouter()

_MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
_METRICS_PATH = os.path.join(_MODELS_DIR, "model_metrics.json")

_MODEL_FILES = [
    "logistic_regression.pkl",
    "knn.pkl",
    "svm.pkl",
    "decision_tree.pkl",
    "random_forest.pkl",
    "gradient_boosting.pkl",
    "xgboost.pkl",
    "scaler.pkl",
]


def _check_models_loaded() -> bool:
    """Return True if all model pickle files exist."""
    return all(os.path.isfile(os.path.join(_MODELS_DIR, f)) for f in _MODEL_FILES)


@router.get("")
async def health_check():
    """
    Liveness and readiness check.

    Returns:
        status (str): 'ok' if the service is running.
        models_loaded (bool): True if all model pkl files are present.
        version (str): API version.
        timestamp (str): ISO-8601 UTC timestamp.
    """
    return {
        "status": "ok",
        "models_loaded": _check_models_loaded(),
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/models")
async def model_metrics():
    """
    Return training metrics for all 7 models.

    Returns:
        list of {name, accuracy, recall, f1} dicts.

    Raises:
        404: If model_metrics.json has not been generated (training not run yet).
    """
    if not os.path.isfile(_METRICS_PATH):
        raise HTTPException(
            status_code=404,
            detail="model_metrics.json not found. Please run the training script first: python models/train_and_save.py",
        )

    with open(_METRICS_PATH, "r", encoding="utf-8") as f:
        metrics: Dict[str, Any] = json.load(f)

    # Convert to a list for easier frontend consumption
    result: List[Dict[str, Any]] = []
    for model_name, model_metrics_val in metrics.items():
        result.append(
            {
                "name": model_name,
                "accuracy": model_metrics_val.get("accuracy"),
                "recall": model_metrics_val.get("recall"),
                "f1": model_metrics_val.get("f1"),
            }
        )

    return result
