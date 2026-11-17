import tempfile
import unittest
from pathlib import Path

import numpy as np
import soundfile as sf
from torch.utils.data import DataLoader

from train import (
    MAX_SEGMENT_MILLISECONDS,
    Segments,
    validate_classifier_segment_duration,
    validate_classifier_split_isolation,
)


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


class ClassifierManifestGuardTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.audio_paths = {}
        for name, payload in (
            ("train.wav", b"train fixture audio"),
            ("validation.wav", b"validation fixture audio"),
            ("test.wav", b"test fixture audio"),
        ):
            path = self.root / name
            path.write_bytes(payload)
            self.audio_paths[name] = str(path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def split_groups(self):
        return {
            "train": [{
                "reciter_id": "reader-a",
                "recording_id": "recording-a",
                "audio_path": self.audio_paths["train.wav"],
            }],
            "validation": [{
                "reciter_id": "reader-b",
                "recording_id": "recording-b",
                "audio_path": self.audio_paths["validation.wav"],
            }],
            "test": [{
                "reciter_id": "reader-c",
                "recording_id": "recording-c",
                "audio_path": self.audio_paths["test.wav"],
            }],
        }

    def test_classifier_window_accepts_four_seconds_and_rejects_longer_segments(self):
        validate_classifier_segment_duration(0, MAX_SEGMENT_MILLISECONDS)
        with self.assertRaisesRegex(ValueError, "segment_exceeds_classifier_window_limit"):
            validate_classifier_segment_duration(0, MAX_SEGMENT_MILLISECONDS + 1)

    def test_same_resolved_audio_file_cannot_cross_splits_under_different_ids(self):
        groups = self.split_groups()
        groups["validation"][0]["audio_path"] = groups["train"][0]["audio_path"]
        with self.assertRaisesRegex(ValueError, "audio_files_must_be_disjoint_across_splits"):
            validate_classifier_split_isolation(groups)

    def test_reciter_and_recording_isolation_are_checked(self):
        groups = self.split_groups()
        groups["validation"][0]["reciter_id"] = groups["train"][0]["reciter_id"]
        with self.assertRaisesRegex(ValueError, "reciters_must_be_disjoint_across_splits"):
            validate_classifier_split_isolation(groups)

        groups = self.split_groups()
        groups["test"][0]["recording_id"] = groups["validation"][0]["recording_id"]
        with self.assertRaisesRegex(ValueError, "recordings_must_be_disjoint_across_splits"):
            validate_classifier_split_isolation(groups)

    def test_multiple_segments_from_one_recording_may_stay_in_the_same_split(self):
        groups = self.split_groups()
        groups["train"].append(dict(groups["train"][0]))
        validate_classifier_split_isolation(groups)

    def test_dataset_refuses_to_truncate_a_long_reviewed_segment(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            sf.write(
                root / "overlong.wav",
                np.zeros(int(5 * 16000), dtype=np.float32),
                16000,
            )
            dataset = Segments(
                [{"audio_path": "overlong.wav", "start_ms": 0, "end_ms": 5000, "label": 1}],
                root,
            )
            with self.assertRaisesRegex(ValueError, "segment_exceeds_classifier_window_limit"):
                dataset[0]


if __name__ == "__main__":
    unittest.main()
