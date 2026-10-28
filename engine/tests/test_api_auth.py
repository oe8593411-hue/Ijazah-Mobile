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


class HealthReadinessTests(unittest.TestCase):
    def test_health_reports_corpus_and_missing_alignment_separately(self):
        with patch.object(api, "get_corpus", return_value={(1, 1): "fixture"}):
            result = api.health()
        self.assertEqual(result["status"], "alignment_not_configured")
        self.assertTrue(result["reference_corpus_ready"])
        self.assertEqual(result["reference_corpus_ayahs"], 1)
        self.assertFalse(result["trusted_server_alignment"])

    def test_health_reports_missing_reference_corpus(self):
        with patch.object(api, "get_corpus", side_effect=FileNotFoundError):
            result = api.health()
        self.assertEqual(result["status"], "trusted_quran_corpus_not_configured")
        self.assertFalse(result["reference_corpus_ready"])
        self.assertEqual(result["reference_corpus_ayahs"], 0)


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

    def test_extremely_large_integer_timestamps_return_client_error(self):
        with self.assertRaises(HTTPException) as ctx:
            api.validate_rule_checks([{
                "ruleId": "qalqalah", "startMs": 10 ** 1000,
                "endMs": 10 ** 1000 + 1, "wordIndex": 0,
            }], 1000)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_word_index_must_fit_reference_ayah(self):
        candidate = {"ruleId": "qalqalah", "startMs": 10, "endMs": 20, "wordIndex": 2}
        with self.assertRaises(HTTPException) as ctx:
            api.validate_rule_checks([candidate], 1000, reference_word_count=2)
        self.assertEqual(ctx.exception.status_code, 400)

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



class TrustedReferenceTests(unittest.TestCase):
    def setUp(self):
        from tajweed_engine import reference
        self.reference = reference
        self.original_path = reference.CORPUS_PATH

    def tearDown(self):
        self.reference.CORPUS_PATH = self.original_path
        self.reference._load_corpus.cache_clear()

    def test_exact_trusted_reference_accepted(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "quran.tsv"
            path.write_text("1\t1\tبِسْمِ اللَّهِ\n1\t2\tالْحَمْدُ لِلَّهِ\n", encoding="utf-8")
            self.reference.CORPUS_PATH = path
            self.reference._load_corpus.cache_clear()
            self.assertTrue(self.reference.validate_reference(1, 1, "بسم الله"))

    def test_wrong_ayah_text_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "quran.tsv"
            path.write_text("1\t1\tبِسْمِ اللَّهِ\n", encoding="utf-8")
            self.reference.CORPUS_PATH = path
            self.reference._load_corpus.cache_clear()
            self.assertFalse(self.reference.validate_reference(1, 1, "نص غير صحيح"))


    def test_invalid_surah_ayah_and_boolean_indices_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "quran.tsv"
            path.write_text("1\t1\tبِسْمِ اللَّهِ\n", encoding="utf-8")
            self.reference.CORPUS_PATH = path
            self.reference._load_corpus.cache_clear()
            for surah, ayah in [(0, 1), (115, 1), (1, 0), (True, 1), (1, False)]:
                with self.subTest(surah=surah, ayah=ayah):
                    self.assertFalse(self.reference.validate_reference(surah, ayah, "بسم الله"))

    def _verified_json_fixture(self):
        payload = {
            "source": "Tanzil Quran Text",
            "edition": "Tanzil Uthmani",
            "riwayah": "hafs",
            "script": "uthmani",
            "version": "1.1",
            "sha256": self.reference.EXPECTED_TANZIL_SHA256,
            "ayahs": [],
        }
        for surah, count in enumerate(self.reference.EXPECTED_SURAH_AYAH_COUNTS, 1):
            for ayah in range(1, count + 1):
                payload["ayahs"].append({
                    "surah": surah, "ayah": ayah,
                    "text": f"نص اختبار {surah} {ayah}",
                })
        return payload

    def test_repository_verified_corpus_matches_pinned_hash_and_verse_counts(self):
        root = Path(__file__).resolve().parents[2]
        self.reference.CORPUS_PATH = root / "src" / "quran" / "verified-corpus.json"
        self.reference._load_corpus.cache_clear()
        corpus = self.reference.get_corpus()
        self.assertEqual(len(corpus), 6236)
        self.assertIn((113, 5), corpus)
        self.assertNotIn((113, 6), corpus)
        self.assertEqual(self.reference.EXPECTED_SURAH_AYAH_COUNTS[112], 5)

    def test_complete_verified_json_corpus_accepted(self):
        corpus = self.reference._parse_verified_json(self._verified_json_fixture())
        self.assertEqual(len(corpus), 6236)
        self.assertEqual(corpus[(1, 1)], "نص اختبار 1 1")
        self.assertEqual(corpus[(114, 6)], "نص اختبار 114 6")

    def test_json_file_loader_pins_the_exact_payload(self):
        import hashlib
        import json

        payload = self._verified_json_fixture()
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        expected_blob_sha = hashlib.sha1(f"blob {len(raw)}\0".encode("ascii") + raw).hexdigest()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "verified-corpus.json"
            path.write_bytes(raw)
            with patch.object(self.reference, "CORPUS_PATH", path), patch.object(
                self.reference, "EXPECTED_VERIFIED_JSON_GIT_BLOB_SHA1", expected_blob_sha
            ):
                self.reference._load_corpus.cache_clear()
                corpus = self.reference.get_corpus()
            self.assertEqual(len(corpus), 6236)

    def test_json_file_loader_rejects_changed_payload(self):
        import json

        payload = self._verified_json_fixture()
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "verified-corpus.json"
            path.write_bytes(raw)
            with patch.object(self.reference, "CORPUS_PATH", path), patch.object(
                self.reference, "EXPECTED_VERIFIED_JSON_GIT_BLOB_SHA1", "0" * 40
            ):
                self.reference._load_corpus.cache_clear()
                with self.assertRaisesRegex(ValueError, "blob_checksum_mismatch"):
                    self.reference.get_corpus()

    def test_verified_json_corpus_rejects_wrong_source_metadata(self):
        payload = self._verified_json_fixture()
        payload["riwayah"] = "warsh"
        with self.assertRaises(ValueError):
            self.reference._parse_verified_json(payload)

    def test_verified_json_corpus_rejects_missing_or_duplicate_ayahs(self):
        payload = self._verified_json_fixture()
        payload["ayahs"].pop()
        with self.assertRaises(ValueError):
            self.reference._parse_verified_json(payload)
        payload = self._verified_json_fixture()
        payload["ayahs"][-1] = payload["ayahs"][0]
        with self.assertRaises(ValueError):
            self.reference._parse_verified_json(payload)

    def test_duplicate_corpus_reference_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "quran.tsv"
            path.write_text("1\t1\tآية أولى\n1\t1\tآية مكررة\n", encoding="utf-8")
            self.reference.CORPUS_PATH = path
            self.reference._load_corpus.cache_clear()
            with self.assertRaises(ValueError):
                self.reference.get_corpus()

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
            with patch.object(api, "authorize"), patch.object(api, "get_corpus", return_value={(1, 1): "بسم الله الرحمن الرحيم"}), patch.object(api, "validate_reference", return_value=True), patch.object(
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
