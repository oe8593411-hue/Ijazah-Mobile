from __future__ import annotations
import io
import numpy as np
import librosa
import soundfile as sf
import torch

SAMPLE_RATE = 16000
MAX_SECONDS = 20.0

def decode_audio(raw: bytes):
    if not raw or len(raw) > 20 * 1024 * 1024:
        raise ValueError('invalid_audio_size')
    try:
        audio, sr = sf.read(io.BytesIO(raw), dtype='float32', always_2d=True)
    except Exception as exc:
        raise ValueError('unsupported_or_corrupt_audio') from exc
    if audio.size == 0 or audio.shape[0] < int(.25 * sr):
        raise ValueError('audio_too_short')
    mono = audio.mean(axis=1)
    if not np.isfinite(mono).all():
        raise ValueError('invalid_audio_values')
    duration = len(mono) / float(sr)
    peak = float(np.max(np.abs(mono)))
    rms = float(np.sqrt(np.mean(np.square(mono)) + 1e-12))
    if duration > MAX_SECONDS:
        raise ValueError('audio_segment_too_long')
    if peak < 1e-4 or rms < 1e-5:
        raise ValueError('audio_silence')
    mono = librosa.resample(mono, orig_sr=sr, target_sr=SAMPLE_RATE).astype(np.float32)
    return mono, {'duration_seconds': duration, 'peak': peak, 'rms': rms}

def log_mel(audio: np.ndarray) -> torch.Tensor:
    mel = librosa.feature.melspectrogram(y=audio, sr=SAMPLE_RATE, n_fft=400, hop_length=160, win_length=400, n_mels=80, fmin=60, fmax=7600, power=2.0)
    value = np.clip(librosa.power_to_db(mel, ref=np.max) / 40.0, -1.0, 0.0).astype(np.float32)
    return torch.from_numpy(value).unsqueeze(0).unsqueeze(0)
