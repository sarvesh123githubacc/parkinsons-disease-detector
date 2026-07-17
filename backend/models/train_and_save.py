"""
Parkinson's Disease ML Training Script

Pipeline:
    1.  Fetch UCI Parkinson's dataset (id=174) via ucimlrepo
    2.  Rename columns to canonical names (handles duplicates)
    3.  Stratified 80/20 train/test split
    4.  Save feature statistics (mean, std) on original training set -> feature_stats.json
    5.  Gaussian feature augmentation on training set (5× multiplier, σ = 0.02 × std)
    6.  SMOTE on augmented training set
    7.  Fit StandardScaler on augmented+SMOTE data
    8.  Train 7 CalibratedClassifierCV models
    9.  Evaluate on original (non-augmented) test set
    10. Save scaler.pkl, 7 model pkl files, model_metrics.json, feature_stats.json

Usage:
    python backend/models/train_and_save.py
    (or)
    cd backend && python models/train_and_save.py
"""

import json
import os
import sys
import warnings

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from xgboost import XGBClassifier

try:
    from imblearn.over_sampling import SMOTE
except ImportError:
    print("imbalanced-learn not installed. Run: pip install imbalanced-learn")
    sys.exit(1)

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))  # .../backend/models/
OUTPUT_DIR = SCRIPT_DIR  # save everything next to this script

# ── Canonical feature names (22 features, matches UCI Parkinson's dataset order) ──
FEATURE_NAMES = [
    "MDVP:Fo",
    "MDVP:Fhi",
    "MDVP:Flo",
    "MDVP:Jitter(%)",
    "MDVP:Jitter(Abs)",
    "MDVP:RAP",
    "MDVP:PPQ",
    "Jitter:DDP",
    "MDVP:Shimmer",
    "MDVP:Shimmer(dB)",
    "Shimmer:APQ3",
    "Shimmer:APQ5",
    "MDVP:APQ",
    "Shimmer:DDA",
    "NHR",
    "HNR",
    "RPDE",
    "DFA",
    "spread1",
    "spread2",
    "D2",
    "PPE",
]


def fetch_dataset():
    """Fetch the UCI Parkinson's dataset directly from UCI URL using pandas."""
    print("Fetching UCI Parkinson's dataset from UCI URL via pandas...")
    import pandas as pd
    url = "https://archive.ics.uci.edu/ml/machine-learning-databases/parkinsons/parkinsons.data"
    df = pd.read_csv(url)
    
    # Drop name column
    if "name" in df.columns:
        df = df.drop(columns=["name"])
        
    # Extract targets
    y = df["status"].values.astype(int)
    df = df.drop(columns=["status"])
    
    # Check shape
    X = df.values.astype(np.float64)
    print(f"Dataset loaded: {X.shape[0]} samples, {X.shape[1]} features")
    print(f"Class distribution — Healthy: {np.sum(y == 0)}, Parkinson's: {np.sum(y == 1)}")
    
    return X, y, FEATURE_NAMES


def augment_gaussian(X: np.ndarray, y: np.ndarray, multiplier: int = 5, sigma_factor: float = 0.02):
    """
    Augment training data with Gaussian noise.

    For each sample, generate `multiplier` additional samples by adding
    Gaussian noise with σ = sigma_factor × per-feature standard deviation.
    """
    feature_stds = X.std(axis=0)
    augmented_X = [X]
    augmented_y = [y]

    for _ in range(multiplier):
        noise = np.random.randn(*X.shape) * (sigma_factor * feature_stds)
        augmented_X.append(X + noise)
        augmented_y.append(y)

    X_aug = np.vstack(augmented_X)
    y_aug = np.concatenate(augmented_y)
    return X_aug, y_aug


def get_model_definitions():
    """Return a list of (name, pkl_filename, base_estimator) tuples."""
    return [
        (
            "logistic_regression",
            "logistic_regression.pkl",
            LogisticRegression(
                C=1.0,
                max_iter=1000,
                solver="lbfgs",
                random_state=42,
            ),
        ),
        (
            "knn",
            "knn.pkl",
            KNeighborsClassifier(n_neighbors=7, weights="distance"),
        ),
        (
            "svm",
            "svm.pkl",
            SVC(C=10.0, kernel="rbf", gamma="scale", random_state=42),
        ),
        (
            "decision_tree",
            "decision_tree.pkl",
            DecisionTreeClassifier(
                max_depth=6,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
            ),
        ),
        (
            "random_forest",
            "random_forest.pkl",
            RandomForestClassifier(
                n_estimators=200,
                max_depth=None,
                min_samples_split=2,
                min_samples_leaf=1,
                random_state=42,
                n_jobs=-1,
            ),
        ),
        (
            "gradient_boosting",
            "gradient_boosting.pkl",
            GradientBoostingClassifier(
                n_estimators=200,
                learning_rate=0.05,
                max_depth=4,
                subsample=0.8,
                random_state=42,
            ),
        ),
        (
            "xgboost",
            "xgboost.pkl",
            XGBClassifier(
                n_estimators=200,
                learning_rate=0.05,
                max_depth=6,
                subsample=0.8,
                colsample_bytree=0.8,

                eval_metric="logloss",
                random_state=42,
                verbosity=0,
            ),
        ),
    ]


def main():
    np.random.seed(42)

    # ── 1. Load data ──────────────────────────────────────────────────────────
    X, y, col_names = fetch_dataset()

    # ── 2. Train/test split (stratified, 80/20) ───────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"\nTrain size: {X_train.shape[0]}, Test size: {X_test.shape[0]}")

    # ── 3. Save feature statistics on ORIGINAL training data ─────────────────
    feature_stats = {}
    for i, name in enumerate(col_names[: X_train.shape[1]]):
        feature_stats[name] = {
            "mean": float(np.mean(X_train[:, i])),
            "std": float(np.std(X_train[:, i])),
            "min": float(np.min(X_train[:, i])),
            "max": float(np.max(X_train[:, i])),
        }

    stats_path = os.path.join(OUTPUT_DIR, "feature_stats.json")
    with open(stats_path, "w") as f:
        json.dump(feature_stats, f, indent=2)
    print(f"Saved feature_stats.json -> {stats_path}")

    # ── 4. Gaussian augmentation (5× on training set only) ───────────────────
    X_train_aug, y_train_aug = augment_gaussian(X_train, y_train, multiplier=5, sigma_factor=0.02)
    print(f"After augmentation — Train: {X_train_aug.shape[0]} samples")

    # ── 5. SMOTE on augmented training set ───────────────────────────────────
    smote = SMOTE(random_state=42, k_neighbors=5)
    X_train_sm, y_train_sm = smote.fit_resample(X_train_aug, y_train_aug)
    print(f"After SMOTE — Train: {X_train_sm.shape[0]} samples")
    print(
        f"SMOTE class distribution — Healthy: {np.sum(y_train_sm == 0)}, "
        f"Parkinson's: {np.sum(y_train_sm == 1)}"
    )

    # ── 6. Fit StandardScaler ─────────────────────────────────────────────────
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_sm)
    X_test_scaled = scaler.transform(X_test)

    scaler_path = os.path.join(OUTPUT_DIR, "scaler.pkl")
    joblib.dump(scaler, scaler_path)
    print(f"\nSaved scaler.pkl -> {scaler_path}")

    # ── 7. Train & evaluate 7 models ─────────────────────────────────────────
    model_definitions = get_model_definitions()
    metrics_summary = {}
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    print("\n" + "=" * 70)
    print("Training and evaluating 7 models...")
    print("=" * 70)

    for model_name, pkl_filename, base_estimator in model_definitions:
        print(f"\n[{model_name}]")

        # Wrap with CalibratedClassifierCV (sigmoid calibration, 5-fold CV)
        calibrated = CalibratedClassifierCV(
            estimator=base_estimator,
            method="sigmoid",
            cv=cv,
        )
        calibrated.fit(X_train_scaled, y_train_sm)

        # Evaluate on original (non-augmented) test set
        y_pred = calibrated.predict(X_test_scaled)
        y_prob = calibrated.predict_proba(X_test_scaled)[:, 1]

        acc = float(accuracy_score(y_test, y_pred))
        rec = float(recall_score(y_test, y_pred, zero_division=0))
        f1 = float(f1_score(y_test, y_pred, zero_division=0))
        cm = confusion_matrix(y_test, y_pred)

        print(f"  Accuracy : {acc:.4f}")
        print(f"  Recall   : {rec:.4f}")
        print(f"  F1 Score : {f1:.4f}")
        print(f"  Confusion Matrix:")
        print(f"    TN={cm[0][0]}  FP={cm[0][1]}")
        print(f"    FN={cm[1][0]}  TP={cm[1][1]}")

        metrics_summary[model_name] = {
            "accuracy": round(acc, 6),
            "recall": round(rec, 6),
            "f1": round(f1, 6),
        }

        # Save model
        model_path = os.path.join(OUTPUT_DIR, pkl_filename)
        joblib.dump(calibrated, model_path)
        print(f"  Saved -> {model_path}")

    # ── 8. Save model metrics ─────────────────────────────────────────────────
    metrics_path = os.path.join(OUTPUT_DIR, "model_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics_summary, f, indent=2)
    print(f"\nSaved model_metrics.json -> {metrics_path}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("TRAINING COMPLETE — Summary")
    print("=" * 70)
    print(f"{'Model':<28} {'Accuracy':>10} {'Recall':>10} {'F1':>10}")
    print("-" * 60)
    for name, m in metrics_summary.items():
        print(f"{name:<28} {m['accuracy']:>10.4f} {m['recall']:>10.4f} {m['f1']:>10.4f}")

    best = max(metrics_summary, key=lambda k: metrics_summary[k]["f1"])
    print(f"\nBest model by F1: {best} (F1={metrics_summary[best]['f1']:.4f})")
    print(f"\nAll artifacts saved to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
