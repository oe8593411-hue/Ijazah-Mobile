from __future__ import annotations
import torch
from torch import nn

class AcousticRuleClassifier(nn.Module):
    """Project-owned baseline classifier for one narrowly defined rule task."""
    def __init__(self, mel_bins: int = 80):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 16, 3, padding=1, bias=False), nn.BatchNorm2d(16), nn.GELU(), nn.MaxPool2d(2),
            nn.Conv2d(16, 32, 3, padding=1, bias=False), nn.BatchNorm2d(32), nn.GELU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1, bias=False), nn.BatchNorm2d(64), nn.GELU(),
            nn.AdaptiveAvgPool2d((1, 1)), nn.Flatten())
        self.classifier = nn.Sequential(nn.Linear(64, 32), nn.GELU(), nn.Dropout(.25), nn.Linear(32, 2))
    def forward(self, spectrogram: torch.Tensor) -> torch.Tensor:
        if spectrogram.ndim != 4 or spectrogram.shape[1] != 1 or spectrogram.shape[2] != 80:
            raise ValueError("expected [batch, 1, 80, frames]")
        return self.classifier(self.features(spectrogram))
