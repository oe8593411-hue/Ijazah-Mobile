import unittest

from train_aligner import build_vocabulary, minimum_ctc_frames, transcript_for_row, validate_split_isolation


class AlignerTrainingDataTests(unittest.TestCase):
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
            {"split": "train", "recording_id": "r1", "reciter_id": "a"},
            {"split": "validation", "recording_id": "r2", "reciter_id": "b"},
            {"split": "test", "recording_id": "r3", "reciter_id": "c"},
        ]
        self.assertEqual(set(validate_split_isolation(rows)), {"train", "validation", "test"})
        rows[2]["reciter_id"] = "a"
        with self.assertRaisesRegex(ValueError, "reciters_must_be_disjoint"):
            validate_split_isolation(rows)


if __name__ == "__main__":
    unittest.main()
