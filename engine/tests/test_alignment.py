import unittest

import numpy as np

from tajweed_engine.alignment import (
    AlignmentConfidenceError,
    AlignmentError,
    align_reference_words,
    ctc_viterbi_align,
    validate_aligner_metadata,
)


def make_log_probabilities(path, class_count):
    values = np.full((len(path), class_count), 0.01 / (class_count - 1), dtype=np.float64)
    for frame, token_id in enumerate(path):
        values[frame, token_id] = 0.99
    values /= values.sum(axis=1, keepdims=True)
    return np.log(values)


class CTCViterbiAlignmentTests(unittest.TestCase):
    def test_aligns_repeated_characters_with_required_blank(self):
        # 0=ا, 1=blank, 2=ا; use distinct char class 0 and blank class 2 instead.
        emissions = make_log_probabilities([0, 0, 2, 0, 0], 3)
        result = ctc_viterbi_align(emissions, [0, 0], blank_id=2)
        self.assertEqual(result[0]["startFrame"], 0)
        self.assertEqual(result[0]["endFrame"], 2)
        self.assertEqual(result[1]["startFrame"], 3)
        self.assertEqual(result[1]["endFrame"], 5)
        self.assertGreater(result[0]["confidence"], 0.9)

    def test_aligns_word_spans_from_reference_text(self):
        emissions = make_log_probabilities([0, 1, 2, 0, 1], 3)
        result = align_reference_words(
            emissions, "اَب اَب", {"ا": 0, "ب": 1}, blank_id=2,
            sample_rate=16000, frame_hop_samples=160, duration_ms=50,
            minimum_mean_character_confidence=0.8,
        )
        self.assertEqual([word["word"] for word in result["words"]], ["اب", "اب"])
        self.assertEqual(result["words"][0]["startMs"], 0)
        self.assertEqual(result["words"][0]["endMs"], 20)
        self.assertEqual(result["words"][1]["startMs"], 30)
        self.assertEqual(result["words"][1]["endMs"], 50)
        self.assertGreater(result["meanCharacterConfidence"], 0.9)

    def test_rejects_reference_characters_missing_from_vocabulary(self):
        emissions = make_log_probabilities([0], 2)
        with self.assertRaisesRegex(AlignmentError, "vocabulary_missing_character"):
            align_reference_words(
                emissions, "ج", {"ا": 0}, blank_id=1, duration_ms=10,
                minimum_mean_character_confidence=0.1,
            )

    def test_rejects_low_confidence_alignment(self):
        probabilities = np.full((3, 3), 1 / 3, dtype=np.float64)
        with self.assertRaises(AlignmentConfidenceError):
            align_reference_words(
                np.log(probabilities), "ا", {"ا": 0}, blank_id=2, duration_ms=30,
                minimum_mean_character_confidence=0.8,
            )

    def test_rejects_impossible_repeated_character_path(self):
        emissions = make_log_probabilities([0, 0], 3)
        with self.assertRaises(AlignmentError):
            ctc_viterbi_align(emissions, [0, 0], blank_id=2)

    def test_rejects_non_log_probability_inputs(self):
        with self.assertRaisesRegex(AlignmentError, "log_probabilities"):
            ctc_viterbi_align(np.ones((3, 3)), [0], blank_id=2)


class AlignerMetadataTests(unittest.TestCase):
    def valid_metadata(self):
        return {
            "task": "quran_ctc_character_alignment_v1",
            "teacher_reviewed": True,
            "calibrated": True,
            "alignment_quality_passed": True,
            "sample_rate": 16000,
            "frame_hop_samples": 160,
            "blank_id": 2,
            "vocabulary": {"ا": 0, "ب": 1},
            "minimum_mean_character_confidence": 0.75,
            "model_sha256": "a" * 64,
        }

    def test_valid_metadata_accepted(self):
        validate_aligner_metadata(self.valid_metadata())

    def test_unreviewed_or_uncalibrated_metadata_rejected(self):
        for key, value in [
            ("teacher_reviewed", False),
            ("calibrated", False),
            ("alignment_quality_passed", False),
        ]:
            metadata = self.valid_metadata()
            metadata[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_aligner_metadata(metadata)

    def test_sparse_vocabulary_ids_rejected(self):
        metadata = self.valid_metadata()
        metadata["vocabulary"] = {"ا": 0, "ب": 3}
        metadata["blank_id"] = 2
        with self.assertRaisesRegex(ValueError, "dense"):
            validate_aligner_metadata(metadata)


if __name__ == "__main__":
    unittest.main()
