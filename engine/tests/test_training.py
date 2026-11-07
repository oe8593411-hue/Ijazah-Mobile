import tempfile
import unittest
from pathlib import Path

import numpy as np
import soundfile as sf
from torch.utils.data import DataLoader

from train import Segments


class TrainingBatchShapeTests(unittest.TestCase):
    def test_different_source_durations_produce_batchable_fixed_windows(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            rng = np.random.default_rng(7)
            sf.write(root / "short.wav", rng.normal(0, 0.05, 8000).astype(np.float32), 16000)
            sf.write(root / "long.wav", rng.normal(0, 0.05, 32000).astype(np.float32), 16000)
            rows = [
                {"audio_path": "short.wav", "start_ms": 0, "end_ms": 500, "label": 0},
                {"audio_path": "long.wav", "start_ms": 0, "end_ms": 2000, "label": 1},
            ]

            loader = DataLoader(Segments(rows, root), batch_size=2)
            features, labels = next(iter(loader))

            self.assertEqual(features.shape[0], 2)
            self.assertEqual(tuple(features[0].shape), tuple(features[1].shape))
            self.assertEqual(labels.tolist(), [0, 1])


if __name__ == "__main__":
    unittest.main()
