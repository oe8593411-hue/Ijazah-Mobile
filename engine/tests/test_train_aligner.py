import tempfile
import unittest
from pathlib import Path

import torch

from train_aligner import (
    build_vocabulary,
    character_error_counts,
    ctc_greedy_decode,
    minimum_ctc_frames,
    transcript_for_row,
    validate_split_isolation,
)


class AlignerEvaluationMetricTests(unittest.TestCase):
    def test_ctc_greedy_decode_collapses_repeats_but_respects_blank_separators(self):
        token_path = [1, 1, 0, 1, 2, 2, 0, 2]
        logits = torch.full((len(token_path), 3), -10.0)
        for frame, token in enumerate(token_path):
            logits[frame, token] = 10.0
        self.assertEqual(ctc_greedy_decode(logits, {1: "ب", 2: "ا"}), "ببا")

    def test_character_error_counts_uses_levenshtein_distance(self):
        self.assertEqual(character_error_counts("كتا", "كتاب"), (1, 4))
        self.assertEqual(character_error_counts("", "نور"), (3, 3))
        self.assertEqual(character_error_counts("نور", "نور"), (0, 3))


class AlignerTrainingDataTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.audio_dir = self.root / "audio"
        self.audio_dir.mkdir()
        for name, payload in (
            ("train.wav", b"train fixture audio"),
            ("validation.wav", b"validation fixture audio"),
            ("test.wav", b"test fixture audio"),
            ("shared.wav", b"shared fixture audio"),
        ):
            (self.audio_dir / name).write_bytes(payload)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_vocabulary_is_dense_and_uses_zero_for_ctc_blank(self):
        vocabulary = build_vocabulary({(1, 1): "بِسْمِ اللَّهِ", (1, 2): "الحمد لله"})
        self.assertEqual(sorted(vocabulary.values()), list(range(1, len(vocabulary) + 1)))
        self.assertIn("ب", vocabulary)

    def test_transcript_is_built_only_from_verified_corpus(self):
        corpus = {(1, 1): "بِسْمِ اللَّهِ", (1, 2): "الْحَمْدُ لِلَّهِ"}
        result = transcript_for_row({"surah": 1, "ayah_start": 1, "ayah_end": 2}, corpus)
        self.assertEqual(result, "بسم الله الحمد لله")

    def test_missing_verified_ayah_rejected(self):
        with self.assertRaisesRegex(ValueError, "not_in_verified_corpus"):
            transcript_for_row({"surah": 1, "ayah_start": 1, "ayah_end": 2}, {(1, 1): "بسم الله"})

    def test_minimum_ctc_length_accounts_for_repeated_characters(self):
        self.assertEqual(minimum_ctc_frames([1, 1, 2, 2, 2]), 8)
        self.assertEqual(minimum_ctc_frames([1, 2, 3]), 3)

    def test_split_isolation_requires_distinct_reciters_and_recordings(self):
        rows = [
            {"split": "train", "recording_id": "r1", "reciter_id": "a", "audio_path": str(self.audio_dir / "train.wav")},
            {"split": "validation", "recording_id": "r2", "reciter_id": "b", "audio_path": str(self.audio_dir / "validation.wav")},
            {"split": "test", "recording_id": "r3", "reciter_id": "c", "audio_path": str(self.audio_dir / "test.wav")},
        ]
        self.assertEqual(set(validate_split_isolation(rows)), {"train", "validation", "test"})
        rows[2]["reciter_id"] = "a"
        with self.assertRaisesRegex(ValueError, "reciters_must_be_disjoint"):
            validate_split_isolation(rows)

    def test_same_audio_file_cannot_be_relabelled_into_another_split(self):
        rows = [
            {"split": "train", "recording_id": "r1", "reciter_id": "a", "audio_path": str(self.audio_dir / "shared.wav")},
            {"split": "validation", "recording_id": "r2", "reciter_id": "b", "audio_path": str(self.audio_dir / "." / "shared.wav")},
            {"split": "test", "recording_id": "r3", "reciter_id": "c", "audio_path": str(self.audio_dir / "test.wav")},
        ]
        with self.assertRaisesRegex(ValueError, "audio_files_must_be_disjoint_across_splits"):
            validate_split_isolation(rows)


    def test_identical_audio_bytes_under_different_names_cannot_cross_splits(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = root / "first.wav"
            renamed_copy = root / "renamed-copy.wav"
            third = root / "third.wav"
            first.write_bytes(b"same reviewed audio bytes")
            renamed_copy.write_bytes(b"same reviewed audio bytes")
            third.write_bytes(b"different test audio")
            rows = [
                {"split": "train", "recording_id": "r1", "reciter_id": "a", "audio_path": str(first)},
                {"split": "validation", "recording_id": "r2", "reciter_id": "b", "audio_path": str(renamed_copy)},
                {"split": "test", "recording_id": "r3", "reciter_id": "c", "audio_path": str(third)},
            ]
            with self.assertRaisesRegex(ValueError, "audio_files_must_be_disjoint_across_splits"):
                validate_split_isolation(rows)



if __name__ == "__main__":
    unittest.main()
