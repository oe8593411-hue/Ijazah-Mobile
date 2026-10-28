import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi import HTTPException
import tajweed_engine.api as api

class AuthorizationTests(unittest.TestCase):
    def test_missing_server_secret_fails_closed(self):
        with patch.object(api, "TOKEN", ""):
            with self.assertRaises(HTTPException) as ctx:
                api.authorize("Bearer anything")
        self.assertEqual(ctx.exception.status_code, 503)

    def test_wrong_token_rejected(self):
        with patch.object(api, "TOKEN", "correct-secret"):
            with self.assertRaises(HTTPException) as ctx:
                api.authorize("Bearer wrong-secret")
        self.assertEqual(ctx.exception.status_code, 401)

    def test_correct_token_accepted(self):
        with patch.object(api, "TOKEN", "correct-secret"):
            self.assertIsNone(api.authorize("Bearer correct-secret"))


class RuleCheckValidationTests(unittest.TestCase):
    def test_valid_timestamped_candidate_accepted(self):
        candidate = {"ruleId": "qalqalah", "startMs": 100, "endMs": 450, "wordIndex": 3}
        self.assertEqual(api.validate_rule_checks([candidate], 1000), [candidate])

    def test_nan_and_infinite_timestamps_rejected(self):
        for start, end in [(float("nan"), 500), (100, float("inf")), (100, float("-inf"))]:
            with self.subTest(start=start, end=end):
                with self.assertRaises(HTTPException) as ctx:
                    api.validate_rule_checks([{"ruleId": "qalqalah", "startMs": start,
                                               "endMs": end, "wordIndex": 0}], 1000)
                self.assertEqual(ctx.exception.status_code, 400)

    def test_boolean_timestamp_and_word_index_rejected(self):
        for field, value in [("startMs", True), ("endMs", False), ("wordIndex", True)]:
            item = {"ruleId": "qalqalah", "startMs": 10, "endMs": 20, "wordIndex": 0}
            item[field] = value
            with self.subTest(field=field):
                with self.assertRaises(HTTPException):
                    api.validate_rule_checks([item], 1000)

    def test_out_of_bounds_or_reversed_timestamps_rejected(self):
        for start, end in [(-1, 20), (20, 20), (30, 20), (10, 1001)]:
            with self.subTest(start=start, end=end):
                with self.assertRaises(HTTPException):
                    api.validate_rule_checks([{"ruleId": "qalqalah", "startMs": start,
                                               "endMs": end, "wordIndex": 0}], 1000)

    def test_malformed_items_and_oversized_lists_rejected(self):
        with self.assertRaises(HTTPException):
            api.validate_rule_checks(["not-an-object"], 1000)
        with self.assertRaises(HTTPException):
            api.validate_rule_checks([{}] * 501, 1000)

class ModelReleaseGateTests(unittest.TestCase):
    def setUp(self):
        self.old_model, self.old_metadata = api.model, api.metadata.copy()

    def tearDown(self):
        api.model, api.metadata = self.old_model, self.old_metadata

    def test_missing_checkpoint_does_not_load_model(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(api, "MODEL_PATH", Path(tmp) / "missing.pt"):
            api.model = None
            api.metadata = {}
            api.load_model()
        self.assertIsNone(api.model)

    def test_unreviewed_checkpoint_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "model.pt"
            path.touch()
            checkpoint = {"metadata": {
                "task": "qalqalah_segment_v1",
                "teacher_reviewed": False,
                "calibrated": False,
                "decision_threshold": 0.9,
            }}
            with patch.object(api, "MODEL_PATH", path), patch.object(api.torch, "load", return_value=checkpoint):
                api.model = None
                api.metadata = {}
                api.load_model()
        self.assertIsNone(api.model)
        self.assertEqual(api.metadata, {})

    def test_uncalibrated_checkpoint_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "model.pt"
            path.touch()
            checkpoint = {"metadata": {
                "task": "qalqalah_segment_v1",
                "teacher_reviewed": True,
                "calibrated": False,
                "decision_threshold": 0.9,
            }}
            with patch.object(api, "MODEL_PATH", path), patch.object(api.torch, "load", return_value=checkpoint):
                api.model = None
                api.metadata = {}
                api.load_model()
        self.assertIsNone(api.model)
        self.assertEqual(api.metadata, {})


class AnalyzeFailClosedTests(unittest.IsolatedAsyncioTestCase):
    async def test_client_timestamps_never_produce_findings_without_server_aligner(self):
        import json
        import numpy as np

        class FakeUpload:
            async def read(self, limit):
                return b"fake-audio"

        original_model = api.model
        original_metadata = api.metadata
        try:
            api.model = object()  # Even a loaded model must not bypass the alignment gate.
            api.metadata = {"decision_threshold": 0.9}
            with patch.object(api, "authorize"), patch.object(
                api, "decode_audio",
                return_value=(np.ones(16000, dtype=np.float32),
                              {"duration_seconds": 1.0, "peak": 1.0, "rms": 1.0}),
            ):
                result = await api.analyze(
                    file=FakeUpload(), surah=1, ayah=1, riwaya="hafs",
                    referenceText="بسم الله الرحمن الرحيم",
                    expectedRuleChecks=json.dumps([{
                        "ruleId": "qalqalah", "startMs": 100, "endMs": 500,
                        "wordIndex": 0,
                    }]),
                    authorization="Bearer test",
                )
            self.assertEqual(result["status"], "not_configured")
            self.assertEqual(result["findings"], [])
            self.assertFalse(result["diagnostics"]["trustedServerAlignment"])
        finally:
            api.model = original_model
            api.metadata = original_metadata

if __name__ == "__main__":
    unittest.main()
