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

if __name__ == "__main__":
    unittest.main()
