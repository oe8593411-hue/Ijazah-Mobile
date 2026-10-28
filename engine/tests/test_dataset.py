import unittest

from tajweed_engine.dataset import validate_label_provenance, validate_segment_timestamps


def valid_row():
    return {
        "recording_id": "clip-001",
        "label": 0,
        "teacher_reviewed": True,
        "rights": {
            "license": "written_permission",
            "reference": "permission-record-001",
            "training_rights_confirmed": True,
            "consent_confirmed": True,
        },
        "reviewers": [
            {"reviewer_id": "teacher-a", "label": 0, "reviewed_at": "2026-10-01"},
            {"reviewer_id": "teacher-b", "label": 0, "reviewed_at": "2026-10-02"},
        ],
    }


class DatasetSegmentValidationTests(unittest.TestCase):
    def test_valid_segment_is_accepted(self):
        validate_segment_timestamps(100, 500, 1000)

    def test_non_finite_reversed_and_too_short_segments_are_rejected(self):
        cases = [
            (float("nan"), 500, 1000),
            (100, float("inf"), 1000),
            (100, 200, float("nan")),
            (200, 100, 1000),
            (100, 349, 1000),
            (-1, 300, 1000),
            (100, 1001, 1000),
            (10 ** 1000, 10 ** 1000 + 500, 1000),
            (True, 500, 1000),
        ]
        for start, end, duration in cases:
            with self.subTest(start=start, end=end, duration=duration):
                with self.assertRaises(ValueError):
                    validate_segment_timestamps(start, end, duration)

class DatasetProvenanceTests(unittest.TestCase):
    def test_two_independent_reviewers_with_consensus_are_accepted(self):
        validate_label_provenance(valid_row())

    def test_disagreement_requires_a_third_adjudicator(self):
        row = valid_row()
        row["reviewers"][1]["label"] = 1
        row["label"] = 1
        with self.assertRaisesRegex(ValueError, "disagreement_requires_independent_adjudication"):
            validate_label_provenance(row)
        row["adjudication"] = {
            "reviewer_id": "teacher-c",
            "label": 1,
            "reviewed_at": "2026-10-03",
        }
        validate_label_provenance(row)

    def test_missing_rights_or_consent_is_rejected(self):
        row = valid_row()
        row["rights"]["training_rights_confirmed"] = False
        with self.assertRaisesRegex(ValueError, "training_rights_not_confirmed"):
            validate_label_provenance(row)
        row = valid_row()
        row["rights"]["consent_confirmed"] = False
        with self.assertRaisesRegex(ValueError, "reciter_consent_not_confirmed"):
            validate_label_provenance(row)

    def test_duplicate_reviewers_are_rejected(self):
        row = valid_row()
        row["reviewers"][1]["reviewer_id"] = row["reviewers"][0]["reviewer_id"]
        with self.assertRaisesRegex(ValueError, "reviewers_must_be_independent"):
            validate_label_provenance(row)

    def test_consensus_must_match_final_label(self):
        row = valid_row()
        row["label"] = 1
        with self.assertRaisesRegex(ValueError, "final_label_must_match_reviewer_consensus"):
            validate_label_provenance(row)

    def test_boolean_labels_and_invalid_dates_are_rejected(self):
        row = valid_row()
        row["label"] = True
        with self.assertRaisesRegex(ValueError, "invalid_final_label"):
            validate_label_provenance(row)
        row = valid_row()
        row["reviewers"][0]["reviewed_at"] = "not-a-date"
        with self.assertRaisesRegex(ValueError, "invalid_review_date"):
            validate_label_provenance(row)

    def test_adjudicator_must_be_independent_and_match_final_label(self):
        row = valid_row()
        row["reviewers"][1]["label"] = 1
        row["label"] = 0
        row["adjudication"] = {
            "reviewer_id": "teacher-a",
            "label": 0,
            "reviewed_at": "2026-10-03",
        }
        with self.assertRaisesRegex(ValueError, "adjudicator_must_be_independent"):
            validate_label_provenance(row)
        row["adjudication"]["reviewer_id"] = "teacher-c"
        row["adjudication"]["label"] = 1
        with self.assertRaisesRegex(ValueError, "final_label_must_match_adjudication"):
            validate_label_provenance(row)


if __name__ == "__main__":
    unittest.main()
