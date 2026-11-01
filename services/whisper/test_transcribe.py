"""Tests for transcribe.py. They use a fake model, so no Whisper weights are needed.

Run from this folder:  python3 -m unittest -v test_transcribe
"""

import os
import sys
import unittest
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import transcribe  # noqa: E402


def word(text, start, end, probability):
    return SimpleNamespace(word=text, start=start, end=end, probability=probability)


class FakeModel:
    def __init__(self, segments, duration=2.5):
        self._segments = segments
        self._duration = duration
        self.calls = []

    def transcribe(self, path, **kwargs):
        self.calls.append((path, kwargs))
        info = SimpleNamespace(language="ar", duration=self._duration)
        return iter(self._segments), info


class WordsFromSegmentsTests(unittest.TestCase):
    def test_words_are_flattened_and_blank_words_are_dropped(self):
        segment = SimpleNamespace(
            words=[word(" بسم", 0.1, 0.5, 0.9), word(" ", 0.5, 0.6, 0.1), word("الله", 0.6, 1.0, 0.8)]
        )
        words = transcribe.words_from_segments([segment])
        self.assertEqual([w["text"] for w in words], ["بسم", "الله"])
        self.assertEqual(words[0]["probability"], 0.9)
        self.assertEqual(words[1]["start"], 0.6)

    def test_segments_without_word_timestamps_contribute_nothing(self):
        self.assertEqual(transcribe.words_from_segments([SimpleNamespace(words=None)]), [])


class TranscribeFileTests(unittest.TestCase):
    def test_arabic_with_word_timestamps_and_no_expected_text_is_sent(self):
        model = FakeModel([SimpleNamespace(words=[word("بسم", 0.0, 0.4, 0.95)])])
        result = transcribe.transcribe_file(model, "clip.wav")
        path, kwargs = model.calls[0]
        self.assertEqual(path, "clip.wav")
        self.assertEqual(kwargs["language"], "ar")
        self.assertTrue(kwargs["word_timestamps"])
        self.assertFalse(kwargs["condition_on_previous_text"])
        self.assertNotIn("initial_prompt", kwargs)
        self.assertNotIn("prefix", kwargs)
        self.assertEqual(result["duration"], 2.5)
        self.assertEqual([w["text"] for w in result["words"]], ["بسم"])


if __name__ == "__main__":
    unittest.main()
