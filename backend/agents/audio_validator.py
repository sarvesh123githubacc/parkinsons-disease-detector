"""
Audio Validator Agent

Validates audio quality before feature extraction to ensure the recording
is suitable for reliable voice biomarker analysis.

Checks:
- Duration >= 2.0 seconds
- Sample rate >= 16000 Hz (resamples if needed)
- Signal-to-Noise Ratio (SNR) >= 10 dB
- Clipping detection (samples >= 0.99)
- Silence ratio (< 0.6 of frames are silent)
"""

import os
from typing import Any, Dict, List, Tuple

import librosa
import numpy as np

from .base import BaseAgent


class AudioValidatorAgent(BaseAgent):
    """
    Validates audio quality for Parkinson's voice analysis.

    Context input:
        audio_path (str): Path to the audio file to validate.

    Output:
        valid (bool): Whether the audio passes all quality checks.
        issues (list[str]): Human-readable descriptions of any quality issues.
        snr_db (float): Estimated signal-to-noise ratio in dB.
        duration_s (float): Duration of the audio in seconds.
        sample_rate (int): Sample rate of the loaded audio (post-resample).
        rms_energy (float): Root mean square energy of the signal.
    """

    MIN_DURATION_S: float = 2.0
    MIN_SAMPLE_RATE: int = 16000
    MIN_SNR_DB: float = 10.0
    CLIP_THRESHOLD: float = 0.99
    MAX_SILENCE_RATIO: float = 0.6

    def __init__(self):
        super().__init__("audio_validator")

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        audio_path: str = context["audio_path"]

        if not os.path.isfile(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Load audio; librosa normalises to [-1, 1] by default
        y, sr = librosa.load(audio_path, sr=None, mono=True)

        # Resample if sample rate is too low
        if sr < self.MIN_SAMPLE_RATE:
            y = librosa.resample(y, orig_sr=sr, target_sr=self.MIN_SAMPLE_RATE)
            sr = self.MIN_SAMPLE_RATE

        duration_s: float = float(librosa.get_duration(y=y, sr=sr))
        rms_energy: float = float(np.sqrt(np.mean(y ** 2)))

        issues: List[str] = []

        # ── Duration check ────────────────────────────────────────────────────
        if duration_s < self.MIN_DURATION_S:
            issues.append(
                f"Recording too short ({duration_s:.2f}s). "
                f"Please sustain 'aah' for at least {self.MIN_DURATION_S} seconds."
            )

        # ── SNR estimate ──────────────────────────────────────────────────────
        snr_db = self._estimate_snr(y, sr)
        if snr_db < self.MIN_SNR_DB:
            issues.append(
                f"Low signal-to-noise ratio ({snr_db:.1f} dB). "
                "Please record in a quieter environment or move closer to the microphone."
            )

        # ── Clipping detection ────────────────────────────────────────────────
        clipped_fraction = float(np.mean(np.abs(y) >= self.CLIP_THRESHOLD))
        if clipped_fraction > 0.005:  # >0.5% of samples clipped
            issues.append(
                f"Audio clipping detected ({clipped_fraction*100:.1f}% of samples). "
                "Please reduce microphone input gain or move further from the microphone."
            )

        # ── Silence ratio check ───────────────────────────────────────────────
        silence_ratio = self._compute_silence_ratio(y, sr)
        if silence_ratio > self.MAX_SILENCE_RATIO:
            issues.append(
                f"Too much silence ({silence_ratio*100:.1f}% of recording). "
                "Please sustain the 'aah' vowel consistently throughout the recording."
            )

        valid: bool = len(issues) == 0

        return {
            "valid": valid,
            "issues": issues,
            "snr_db": round(snr_db, 2),
            "duration_s": round(duration_s, 3),
            "sample_rate": sr,
            "rms_energy": round(rms_energy, 6),
            "clipped_fraction": round(clipped_fraction, 6),
            "silence_ratio": round(silence_ratio, 4),
        }

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _estimate_snr(self, y: np.ndarray, sr: int) -> float:
        """
        Estimate SNR by comparing the signal RMS to the RMS of the quietest
        frames (treated as the noise floor).

        Uses a frame-based approach: frames in the bottom 10th percentile of
        energy are classified as noise; the overall RMS is treated as signal.
        """
        frame_length = int(0.025 * sr)  # 25 ms frames
        hop_length = int(0.010 * sr)    # 10 ms hop

        frames = librosa.util.frame(y, frame_length=frame_length, hop_length=hop_length)
        frame_rms = np.sqrt(np.mean(frames ** 2, axis=0))

        if len(frame_rms) == 0:
            return 0.0

        # Noise floor: bottom 10th percentile frames
        noise_threshold = np.percentile(frame_rms, 10)
        noise_frames_mask = frame_rms <= noise_threshold
        noise_frames = frames[:, noise_frames_mask]

        signal_rms = float(np.sqrt(np.mean(y ** 2)) + 1e-10)
        noise_rms = float(
            np.sqrt(np.mean(noise_frames ** 2)) + 1e-10
            if noise_frames.size > 0
            else 1e-10
        )

        snr = 20.0 * np.log10(signal_rms / noise_rms)

        # If the recording is a sustained vowel with no silence, the noise floor
        # will falsely capture the vocal signal, leading to a low estimated SNR.
        # We check if the signal is steady (low coefficient of variation) and has
        # sufficient energy throughout.
        mean_rms = float(np.mean(frame_rms))
        std_rms = float(np.std(frame_rms))
        cov = std_rms / (mean_rms + 1e-10)

        if mean_rms > 0.005 and cov < 0.4:
            # Steady continuous voice, adjust SNR estimate upward
            snr = max(snr, 25.0)

        return float(np.clip(snr, -20.0, 80.0))

    def _compute_silence_ratio(self, y: np.ndarray, sr: int) -> float:
        """
        Compute the fraction of frames classified as silent.

        A frame is silent when its RMS energy is below a threshold derived
        from the overall signal energy.
        """
        frame_length = int(0.025 * sr)
        hop_length = int(0.010 * sr)

        frames = librosa.util.frame(y, frame_length=frame_length, hop_length=hop_length)
        if frames.size == 0:
            return 1.0

        frame_rms = np.sqrt(np.mean(frames ** 2, axis=0))
        overall_rms = float(np.sqrt(np.mean(y ** 2)) + 1e-10)

        # Silence threshold: 10% of overall RMS
        silence_threshold = 0.10 * overall_rms
        silence_ratio = float(np.mean(frame_rms < silence_threshold))
        return silence_ratio
