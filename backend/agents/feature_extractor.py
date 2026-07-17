"""
Feature Extractor Agent

Extracts 22 voice biomarkers from a raw audio file using librosa.
Loads the pre-trained StandardScaler and returns both raw and scaled features.

Features extracted (in order):
    MDVP:Fo, MDVP:Fhi, MDVP:Flo,
    MDVP:Jitter(%), MDVP:Jitter(Abs), MDVP:RAP, MDVP:PPQ, Jitter:DDP,
    MDVP:Shimmer, MDVP:Shimmer(dB), Shimmer:APQ3, Shimmer:APQ5, MDVP:APQ, Shimmer:DDA,
    NHR, HNR,
    RPDE, DFA, spread1, spread2, D2, PPE
"""

import os
from typing import Any, Dict, List

import joblib
import librosa
import numpy as np

from .base import BaseAgent

# ── Canonical feature order (must match training) ──────────────────────────────
FEATURE_NAMES: List[str] = [
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

# Path to scaler (agents/ -> backend/models/)
_MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
_SCALER_PATH = os.path.join(_MODELS_DIR, "scaler.pkl")


def _load_scaler():
    """Load scaler lazily; returns None if not yet trained."""
    if os.path.isfile(_SCALER_PATH):
        return joblib.load(_SCALER_PATH)
    return None


# ── Core feature extraction function ──────────────────────────────────────────

def extract_features(y: np.ndarray, sr: int) -> Dict[str, float]:
    """Extract all 22 biomarkers from an audio signal."""

    # Ensure mono float32
    if y.ndim > 1:
        y = np.mean(y, axis=0)
    y = y.astype(np.float32)

    # ── F0 extraction via pYIN ────────────────────────────────────────────────
    f0, voiced_flag, _ = librosa.pyin(
        y,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C7"),
        sr=sr,
    )
    f0_voiced = f0[voiced_flag] if voiced_flag is not None else np.array([])
    f0_voiced = f0_voiced[np.isfinite(f0_voiced)]
    if len(f0_voiced) == 0:
        f0_voiced = np.array([150.0])

    fo = float(np.mean(f0_voiced))
    fhi = float(np.max(f0_voiced))
    flo = float(np.min(f0_voiced))

    # ── Jitter measures ───────────────────────────────────────────────────────
    periods = 1.0 / (f0_voiced + 1e-9)
    mean_period = float(np.mean(periods))

    if len(periods) > 1:
        abs_diffs = np.abs(np.diff(periods))
        jitter_abs = float(np.mean(abs_diffs))
        jitter_pct = float(jitter_abs / (mean_period + 1e-9))

        # RAP: 3-point smoothing
        if len(periods) > 2:
            rap_vals = [
                abs(periods[i] - np.mean(periods[max(0, i - 1): i + 2]))
                for i in range(1, len(periods) - 1)
            ]
            rap = float(np.mean(rap_vals) / (mean_period + 1e-9))
        else:
            rap = 0.0

        # PPQ: 5-point smoothing
        if len(periods) > 4:
            ppq_vals = [
                abs(periods[i] - np.mean(periods[max(0, i - 2): i + 3]))
                for i in range(2, len(periods) - 2)
            ]
            ppq = float(np.mean(ppq_vals) / (mean_period + 1e-9))
        else:
            ppq = 0.0

        # DDP: average absolute difference of consecutive differences
        if len(abs_diffs) > 1:
            ddp = float(np.mean(np.abs(np.diff(abs_diffs))) / (mean_period + 1e-9))
        else:
            ddp = 0.0
    else:
        jitter_abs = jitter_pct = rap = ppq = ddp = 0.0

    # ── Shimmer measures ──────────────────────────────────────────────────────
    frame_length = min(512, len(y) // 4)
    hop_length = frame_length // 2

    frames = librosa.util.frame(y, frame_length=frame_length, hop_length=hop_length)
    amplitudes = np.max(np.abs(frames), axis=0).astype(np.float64)
    amplitudes = amplitudes[amplitudes > 1e-6]

    if len(amplitudes) > 1:
        mean_amp = float(np.mean(amplitudes))
        amp_diffs = np.abs(np.diff(amplitudes))

        shimmer = float(np.mean(amp_diffs) / (mean_amp + 1e-9))
        shimmer_db = float(20.0 * np.log10(1.0 + shimmer + 1e-9))

        # APQ3
        if len(amplitudes) > 2:
            apq3_vals = [
                abs(amplitudes[i] - np.mean(amplitudes[max(0, i - 1): i + 2]))
                for i in range(1, len(amplitudes) - 1)
            ]
            apq3 = float(np.mean(apq3_vals) / (mean_amp + 1e-9))
        else:
            apq3 = 0.0

        # APQ5
        if len(amplitudes) > 4:
            apq5_vals = [
                abs(amplitudes[i] - np.mean(amplitudes[max(0, i - 2): i + 3]))
                for i in range(2, len(amplitudes) - 2)
            ]
            apq5 = float(np.mean(apq5_vals) / (mean_amp + 1e-9))
        else:
            apq5 = 0.0

        # APQ11 (MDVP:APQ)
        if len(amplitudes) > 10:
            apq11_vals = [
                abs(amplitudes[i] - np.mean(amplitudes[max(0, i - 5): i + 6]))
                for i in range(5, len(amplitudes) - 5)
            ]
            apq11 = float(np.mean(apq11_vals) / (mean_amp + 1e-9))
        else:
            apq11 = 0.0

        # DDA: average absolute difference of consecutive amplitude diffs
        if len(amp_diffs) > 1:
            dda = float(np.mean(np.abs(np.diff(amp_diffs))) / (mean_amp + 1e-9))
        else:
            dda = 0.0
    else:
        shimmer = shimmer_db = apq3 = apq5 = apq11 = dda = 0.0

    # ── HNR / NHR ─────────────────────────────────────────────────────────────
    harmonic = librosa.effects.harmonic(y)
    noise = y - harmonic
    harmonic_rms = float(np.sqrt(np.mean(harmonic ** 2)) + 1e-10)
    noise_rms = float(np.sqrt(np.mean(noise ** 2)) + 1e-10)
    hnr = float(20.0 * np.log10(harmonic_rms / noise_rms))
    nhr = float(noise_rms / harmonic_rms)

    # ── RPDE – Recurrence Period Density Entropy (spectral entropy proxy) ─────
    S = np.abs(librosa.stft(y))
    S_norm = S / (S.sum(axis=0, keepdims=True) + 1e-9)
    spectral_entropy = float(-np.mean(np.sum(S_norm * np.log(S_norm + 1e-9), axis=0)))
    rpde = float(np.clip(spectral_entropy / 10.0, 0.20, 0.70))

    # ── DFA – Detrended Fluctuation Analysis (spectral flatness proxy) ────────
    flatness = librosa.feature.spectral_flatness(y=y)
    dfa = float(np.clip(0.5 + float(np.mean(flatness)) * 2.0, 0.5, 0.9))

    # ── Spread1 / Spread2 – nonlinear F0 spread measures ─────────────────────
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
    spread1 = float(-float(np.mean(centroid)) / 1000.0 - 3.0)
    spread2 = float(float(np.mean(bandwidth)) / 5000.0)

    # ── D2 – Correlation Dimension (MFCC variance proxy) ─────────────────────
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    d2 = float(np.clip(float(np.std(mfcc)) / 10.0 + 1.5, 1.4, 3.7))

    # ── PPE – Pitch Period Entropy ────────────────────────────────────────────
    if len(f0_voiced) > 1:
        f0_norm = f0_voiced / (float(np.max(f0_voiced)) + 1e-9)
        hist, _ = np.histogram(f0_norm, bins=20, density=True)
        hist = hist + 1e-9
        hist = hist / hist.sum()
        ppe = float(-np.sum(hist * np.log(hist)))
        ppe = float(np.clip(ppe / 10.0, 0.04, 0.53))
    else:
        ppe = 0.2

    return {
        "MDVP:Fo": fo,
        "MDVP:Fhi": fhi,
        "MDVP:Flo": flo,
        "MDVP:Jitter(%)": jitter_pct,
        "MDVP:Jitter(Abs)": jitter_abs,
        "MDVP:RAP": rap,
        "MDVP:PPQ": ppq,
        "Jitter:DDP": ddp,
        "MDVP:Shimmer": shimmer,
        "MDVP:Shimmer(dB)": shimmer_db,
        "Shimmer:APQ3": apq3,
        "Shimmer:APQ5": apq5,
        "MDVP:APQ": apq11,
        "Shimmer:DDA": dda,
        "NHR": nhr,
        "HNR": hnr,
        "RPDE": rpde,
        "DFA": dfa,
        "spread1": spread1,
        "spread2": spread2,
        "D2": d2,
        "PPE": ppe,
    }


# ── Agent class ────────────────────────────────────────────────────────────────

class FeatureExtractorAgent(BaseAgent):
    """
    Extracts 22 voice biomarkers from an audio file and scales them using the
    pre-trained StandardScaler.

    Context input:
        audio_path (str): Path to the audio file.

    Output:
        features_raw (dict): Raw (unscaled) feature values.
        features_scaled (list): Scaled feature vector (same order as FEATURE_NAMES).
        feature_names (list): Ordered list of feature names.
    """

    def __init__(self):
        super().__init__("feature_extractor")
        self._scaler = None

    def _get_scaler(self):
        if self._scaler is None:
            self._scaler = _load_scaler()
        return self._scaler

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        audio_path: str = context["audio_path"]

        # Load audio (target 22050 Hz for reliable librosa processing)
        y, sr = librosa.load(audio_path, sr=22050, mono=True)

        raw: Dict[str, float] = extract_features(y, sr)

        # Build ordered feature vector
        feature_vector = [raw[name] for name in FEATURE_NAMES]

        # Scale
        scaler = self._get_scaler()
        if scaler is not None:
            scaled = scaler.transform([feature_vector])[0].tolist()
        else:
            # Fallback: return unscaled if model has not been trained yet
            scaled = feature_vector

        return {
            "features_raw": {k: round(v, 8) for k, v in raw.items()},
            "features_scaled": [round(v, 8) for v in scaled],
            "feature_names": FEATURE_NAMES,
        }
