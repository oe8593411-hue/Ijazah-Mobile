from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

CORPUS_PATH = Path(os.getenv("IJAZAH_QURAN_CORPUS_PATH", "/data/verified-corpus.json"))
EXPECTED_TANZIL_SHA256 = "bf4f57b968d03f4131c070b1e285da9be0e0a108a21c910e872801ca273312c8"
EXPECTED_SURAH_AYAH_COUNTS = (7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,)
_ARABIC_MARKS = re.compile("[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]")
_WHITESPACE = re.compile(r"\s+")


def normalize_reference(text: str) -> str:
    """Normalize whitespace and Quranic combining marks for comparison only."""
    text = _ARABIC_MARKS.sub("", text)
    return _WHITESPACE.sub(" ", text).strip()


def _parse_verified_json(payload: Any) -> dict[tuple[int, int], str]:
    """Load the app's versioned Tanzil corpus and require its complete Hafs shape."""
    if not isinstance(payload, dict):
        raise ValueError("trusted_quran_json_invalid")
    expected_metadata = {
        "source": "Tanzil Quran Text",
        "edition": "Tanzil Uthmani",
        "riwayah": "hafs",
        "script": "uthmani",
        "version": "1.1",
        "sha256": EXPECTED_TANZIL_SHA256,
    }
    for field, expected in expected_metadata.items():
        if payload.get(field) != expected:
            raise ValueError(f"trusted_quran_metadata_mismatch:{field}")

    ayahs = payload.get("ayahs")
    if not isinstance(ayahs, list) or len(ayahs) != sum(EXPECTED_SURAH_AYAH_COUNTS):
        raise ValueError("trusted_quran_ayah_count_mismatch")

    corpus: dict[tuple[int, int], str] = {}
    counts = [0] * 114
    for index, item in enumerate(ayahs, 1):
        if not isinstance(item, dict):
            raise ValueError(f"invalid_quran_corpus_entry:{index}")
        surah, ayah, text = item.get("surah"), item.get("ayah"), item.get("text")
        if (
            isinstance(surah, bool) or not isinstance(surah, int)
            or isinstance(ayah, bool) or not isinstance(ayah, int)
            or not 1 <= surah <= 114
            or not 1 <= ayah <= EXPECTED_SURAH_AYAH_COUNTS[surah - 1]
            or not isinstance(text, str) or not text.strip()
        ):
            raise ValueError(f"invalid_quran_corpus_entry:{index}")
        key = (surah, ayah)
        if key in corpus:
            raise ValueError(f"duplicate_quran_corpus_entry:{index}")
        corpus[key] = text.strip()
        counts[surah - 1] += 1

    if tuple(counts) != EXPECTED_SURAH_AYAH_COUNTS:
        raise ValueError("trusted_quran_surah_counts_mismatch")
    return corpus


def _parse_tsv_corpus(path: Path) -> dict[tuple[int, int], str]:
    """Read a locally supplied TSV reference; production default uses verified JSON."""
    corpus: dict[tuple[int, int], str] = {}
    with path.open("r", encoding="utf-8-sig") as handle:
        for line_number, line in enumerate(handle, 1):
            line = line.rstrip("\r\n")
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t", 2)
            if len(parts) != 3:
                raise ValueError(f"invalid_quran_corpus_line:{line_number}")
            try:
                surah, ayah = int(parts[0]), int(parts[1])
            except ValueError as exc:
                raise ValueError(f"invalid_quran_corpus_reference:{line_number}") from exc
            text = parts[2].strip()
            if not 1 <= surah <= 114 or ayah < 1 or not text:
                raise ValueError(f"invalid_quran_corpus_entry:{line_number}")
            key = (surah, ayah)
            if key in corpus:
                raise ValueError(f"duplicate_quran_corpus_entry:{line_number}")
            corpus[key] = text
    if not corpus:
        raise ValueError("trusted_quran_corpus_empty")
    return corpus


@lru_cache(maxsize=4)
def _load_corpus(path_string: str, modified_ns: int, size: int) -> dict[tuple[int, int], str]:
    del modified_ns, size  # Values are cache-key invalidators.
    path = Path(path_string)
    if not path.is_file():
        raise FileNotFoundError("trusted_quran_corpus_missing")
    if path.suffix.lower() == ".json":
        with path.open("r", encoding="utf-8-sig") as handle:
            return _parse_verified_json(json.load(handle))
    return _parse_tsv_corpus(path)


def get_corpus() -> dict[tuple[int, int], str]:
    path = CORPUS_PATH
    stat = path.stat()
    return _load_corpus(str(path), stat.st_mtime_ns, stat.st_size)


def validate_reference(surah: int, ayah: int, supplied_text: str) -> bool:
    """Return False when the trusted corpus is absent or reference does not match."""
    if isinstance(surah, bool) or isinstance(ayah, bool):
        return False
    if not isinstance(surah, int) or not isinstance(ayah, int):
        return False
    if not 1 <= surah <= 114 or ayah < 1 or not isinstance(supplied_text, str):
        return False
    try:
        corpus = get_corpus()
    except (FileNotFoundError, ValueError, OSError, json.JSONDecodeError):
        return False
    trusted = corpus.get((surah, ayah))
    if trusted is None:
        return False
    return normalize_reference(supplied_text) == normalize_reference(trusted)
