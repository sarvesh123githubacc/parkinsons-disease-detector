"""
ML Ensemble Agent

Loads all 7 trained model pkl files and runs inference to produce individual
and ensemble predictions.

Models:
    - logistic_regression
    - knn
    - svm
    - decision_tree
    - random_forest
    - gradient_boosting
    - xgboost

Lazy-loads and caches all models on first call.
"""

import os
from typing import Any, Dict, List, Optional

import joblib
import numpy as np

from .base import BaseAgent

# ── Model file mapping ─────────────────────────────────────────────────────────
_MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")

_MODEL_FILES: Dict[str, str] = {
    "logistic_regression": "logistic_regression.pkl",
    "knn": "knn.pkl",
    "svm": "svm.pkl",
    "decision_tree": "decision_tree.pkl",
    "random_forest": "random_forest.pkl",
    "gradient_boosting": "gradient_boosting.pkl",
    "xgboost": "xgboost.pkl",
}

# Cached models (module-level so they survive across requests)
_MODEL_CACHE: Dict[str, Any] = {}


def _get_models() -> Dict[str, Any]:
    """Load all models lazily; return from cache after first load."""
    global _MODEL_CACHE
    if not _MODEL_CACHE:
        for name, filename in _MODEL_FILES.items():
            path = os.path.join(_MODELS_DIR, filename)
            if os.path.isfile(path):
                _MODEL_CACHE[name] = joblib.load(path)
            else:
                _MODEL_CACHE[name] = None
    return _MODEL_CACHE


class MLEnsembleAgent(BaseAgent):
    """
    Runs all 7 calibrated classifiers on scaled feature input and
    computes an ensemble vote.

    Context input:
        features_scaled (list[float]): Scaled feature vector of length 22.

    Output:
        model_results (dict): Per-model prediction, probability, and label.
        primary_prediction (int): Prediction from random_forest (primary model).
        primary_probability (float): PD probability from primary model.
        ensemble_vote (int): Majority vote across all models.
        ensemble_probability (float): Mean probability across all models.
        models_agreeing (int): Number of models agreeing with primary prediction.
    """

    def __init__(self):
        super().__init__("ml_ensemble")

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        features_scaled: List[float] = context["features_scaled"]
        X = np.array(features_scaled).reshape(1, -1)

        models = _get_models()

        model_results: Dict[str, Dict[str, Any]] = {}
        predictions: List[int] = []
        probabilities: List[float] = []

        for name, model in models.items():
            if model is None:
                model_results[name] = {
                    "prediction": -1,
                    "probability": 0.0,
                    "label": "Model not available",
                }
                continue

            pred = int(model.predict(X)[0])
            proba_raw = model.predict_proba(X)[0]
            # Index 1 = probability of class "1" (Parkinson's)
            prob = float(proba_raw[1]) if len(proba_raw) > 1 else float(proba_raw[0])

            label = "Parkinson's" if pred == 1 else "Healthy"
            model_results[name] = {
                "prediction": pred,
                "probability": round(prob, 6),
                "label": label,
            }
            predictions.append(pred)
            probabilities.append(prob)

        # ── Primary model: random_forest (highest weight) ──────────────────────
        primary_model_key = "random_forest"
        if (
            primary_model_key in model_results
            and model_results[primary_model_key]["prediction"] != -1
        ):
            primary_prediction = model_results[primary_model_key]["prediction"]
            primary_probability = model_results[primary_model_key]["probability"]
        elif predictions:
            # Fallback to first available model
            primary_prediction = predictions[0]
            primary_probability = probabilities[0]
        else:
            primary_prediction = 0
            primary_probability = 0.0

        # ── Ensemble ───────────────────────────────────────────────────────────
        if predictions:
            ensemble_vote = int(round(np.mean(predictions)))
            ensemble_probability = round(float(np.mean(probabilities)), 6)
            models_agreeing = int(sum(1 for p in predictions if p == primary_prediction))
        else:
            ensemble_vote = 0
            ensemble_probability = 0.0
            models_agreeing = 0

        return {
            "model_results": model_results,
            "primary_prediction": primary_prediction,
            "primary_probability": primary_probability,
            "ensemble_vote": ensemble_vote,
            "ensemble_probability": ensemble_probability,
            "models_agreeing": models_agreeing,
        }
