from __future__ import annotations
import io
import shutil
import subprocess
import numpy as np
import librosa
import soundfile as sf
import torch

SAMPLE_RATE = 16000
MAX_SECONDS = 20.0
MAX_BYTES = 20 * 1024 * 1024


def _decode_with_ffmpeg(raw: bytes) -> tuple[np.ndarray, float]:
    """Decode common mobile containers through installed FFmpeg with strict limits."""
    ffprobe = shutil.which("ffprobe")
    ffmpeg = shutil.which("ffmpeg")
    if not ffprobe or not ffmpeg:
        raise ValueError("unsupported_or_corrupt_audio")

    probe_args = [
        ffprobe, "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", "-i", "pipe:0",
    ]
    try:
        probe = subprocess.run(
            probe_args, input=raw, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=8, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ValueError("audio_decode_failed") from exc
    if probe.returncode != 0:
        raise ValueError("unsupported_or_corrupt_audio")
    try:
        duration = float(probe.stdout.decode("ascii", errors="strict").strip())
    except (UnicodeDecodeError, ValueError) as exc:
        raise ValueError("invalid_audio_duration") from exc
    if not np.isfinite(duration) or duration <= 0:
        raise ValueError("invalid_audio_duration")
    if duration > MAX_SECONDS:
        raise ValueError("audio_segment_too_long")

    decode_args = [
        ffmpeg, "-nostdin", "-v", "error", "-i", "pipe:0",
        "-map", "0:a:0", "-vn", "-t", str(MAX_SECONDS),
        "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "f32le", "pipe:1",
    ]
    try:
        decoded = subprocess.run(
            decode_args, input=raw, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=20, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ValueError("audio_decode_failed") from exc
    if decoded.returncode != 0 or not decoded.stdout or len(decoded.stdout) % 4:
        raise ValueError("unsupported_or_corrupt_audio")
    mono = np.frombuffer(decoded.stdout, dtype="<f4").astype(np.float32, copy=True)
    # Never let decoder output exceed the same duration contract used by the API.
    if not len(mono) or len(mono) > int(SAMPLE_RATE * MAX_SECONDS):
        raise ValueError("audio_segment_too_long")
    return mono, len(mono) / float(SAMPLE_RATE)


def decode_audio(raw: bytes):
    if not raw or len(raw) > MAX_BYTES:
        raise ValueError("invalid_audio_size")
    used_ffmpeg = False
    try:
        audio, sr = sf.read(io.BytesIO(raw), dtype="float32", always_2d=True)
    except Exception:
        mono, duration = _decode_with_ffmpeg(raw)
        sr = SAMPLE_RATE
        used_ffmpeg = True
    else:
        if sr <= 0 or audio.size == 0:
            raise ValueError("unsupported_or_corrupt_audio")
        mono = audio.mean(axis=1)
        duration = len(mono) / float(sr)

    if len(mono) < int(.25 * sr):
        raise ValueError("audio_too_short")
    if not np.isfinite(mono).all():
        raise ValueError("invalid_audio_values")
    if duration > MAX_SECONDS:
        raise ValueError("audio_segment_too_long")
    peak = float(np.max(np.abs(mono)))
    rms = float(np.sqrt(np.mean(np.square(mono)) + 1e-12))
    if peak < 1e-4 or rms < 1e-5:
        raise ValueError("audio_silence")
    if not used_ffmpeg:
        mono = librosa.resample(mono, orig_sr=sr, target_sr=SAMPLE_RATE).astype(np.float32)
    return mono.astype(np.float32, copy=False), {
        "duration_seconds": duration, "peak": peak, "rms": rms,
        "decoder": "ffmpeg" if used_ffmpeg else "libsndfile",
    }


def log_mel(audio: np.ndarray) -> torch.Tensor:
    mel = librosa.feature.melspectrogram(y=audio, sr=SAMPLE_RATE, n_fft=400, hop_length=160, win_length=400, n_mels=80, fmin=60, fmax=7600, power=2.0)
    value = np.clip(librosa.power_to_db(mel, ref=np.max) / 40.0, -1.0, 0.0).astype(np.float32)
    return torch.from_numpy(value).unsqueeze(0).unsqueeze(0)
