from __future__ import annotations

import unittest

import numpy as np

from engine.tajweed_engine.alignment import (
    AlignmentConfidenceError,
    AlignmentError,
    align_reference_words,
    ctc_viterbi_align,
    validate_aligner_metadata,
)


def log_probs(labels: list[int], class_count: int = 2) -> np.ndarray:
    probabilities = np.full((len(labels), class_count), 0.01, dtype=np.float64)
    for frame, label in enumerate(labels):
        probabilities[frame, label] = 0.99
    probabilities /= probabilities.sum(axis=1, keepdims=True)
    return np.log(probabilities)


class CtcAlignmentTests(unittest.TestCase):
    def test_repeated_characters_require_intervening_blank(self):
        aligned = ctc_viterbi_align(
            log_probs([0, 1, 0, 1, 1]),
            token_ids=[0, 0],
            blank_id=1,
        )
        self.assertEqual(len(aligned), 2)
        self.assertLess(aligned[0]["startFrame"], aligned[0]["endFrame"])
        self.assertLess(aligned[0]["endFrame"], aligned[1]["endFrame"])
        self.assertEqual(aligned[1]["startFrame"], 2)

    def test_rejects_non_log_probabilities(self):
        with self.assertRaisesRegex(AlignmentError, "ctc_output_must_be_log_probabilities"):
            ctc_viterbi_align(np.zeros((3, 2)), [0], 1)

    def test_rejects_non_finite_model_output(self):
        values = log_probs([0, 1, 0])
        values[1, 0] = np.nan
        with self.assertRaisesRegex(AlignmentError, "ctc_output_non_finite"):
            ctc_viterbi_align(values, [0], 1)

    def test_rejects_missing_ctc_path(self):
        with self.assertRaises(AlignmentError):
            ctc_viterbi_align(log_probs([1, 1]), [0, 0, 0], 1)

    def test_low_confidence_alignment_is_not_accepted(self):
        values = np.log(np.full((5, 2), 0.5, dtype=np.float64))
        with self.assertRaises(AlignmentConfidenceError):
            align_reference_words(
                values,
                "ا",
                {"ا": 0},
                1,
                duration_ms=50,
                minimum_mean_character_confidence=0.9,
            )

    def test_metadata_requires_all_release_gates(self):
        metadata = {
            "task": "quran_ctc_character_alignment_v1",
            "teacher_reviewed": True,
            "calibrated": True,
            "alignment_quality_passed": True,
            "sample_rate": 16000,
            "frame_hop_samples": 160,
            "blank_id": 0,
            "minimum_mean_character_confidence": 0.8,
            "model_sha256": "a" * 64,
            "vocabulary": {"ا": 1},
        }
        validate_aligner_metadata(metadata)
        metadata["teacher_reviewed"] = False
        with self.assertRaisesRegex(ValueError, "aligner_release_gate_not_passed"):
            validate_aligner_metadata(metadata)


if __name__ == "__main__":
    unittest.main()
