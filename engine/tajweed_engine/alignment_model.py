from __future__ import annotations

import torch
from torch import nn


class QuranCTCAcousticModel(nn.Module):
    """Small Ijazah-owned framewise acoustic encoder for supervised CTC training."""

    def __init__(self, num_classes: int, hidden_size: int = 96):
        super().__init__()
        if isinstance(num_classes, bool) or not isinstance(num_classes, int) or num_classes < 2:
            raise ValueError("num_classes must include at least one character and the CTC blank")
        if isinstance(hidden_size, bool) or not isinstance(hidden_size, int) or hidden_size < 16:
            raise ValueError("hidden_size must be at least 16")
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=(3, 1), padding=(1, 0), bias=False),
            nn.BatchNorm2d(32),
            nn.GELU(),
            nn.MaxPool2d(kernel_size=(2, 1)),
            nn.Conv2d(32, 64, kernel_size=(3, 1), padding=(1, 0), bias=False),
            nn.BatchNorm2d(64),
            nn.GELU(),
            nn.MaxPool2d(kernel_size=(2, 1)),
            nn.Conv2d(64, 96, kernel_size=(3, 1), padding=(1, 0), bias=False),
            nn.BatchNorm2d(96),
            nn.GELU(),
        )
        # A forward-only GRU ensures padded batch frames cannot change earlier outputs.
        self.encoder = nn.GRU(
            input_size=96, hidden_size=hidden_size, num_layers=2,
            batch_first=True, bidirectional=False, dropout=0.15,
        )
        self.classifier = nn.Linear(hidden_size, num_classes)

    def forward(self, mel: torch.Tensor) -> torch.Tensor:
        if mel.ndim != 4 or mel.shape[1] != 1 or mel.shape[2] != 80:
            raise ValueError("expected log-mel input shaped [batch, 1, 80, frames]")
        features = self.features(mel).mean(dim=2).transpose(1, 2)
        encoded, _ = self.encoder(features)
        return self.classifier(encoded)
