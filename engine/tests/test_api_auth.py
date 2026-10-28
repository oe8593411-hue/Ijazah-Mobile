import unittest
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

if __name__ == "__main__":
    unittest.main()
