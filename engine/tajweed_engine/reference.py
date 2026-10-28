from __future__ import annotations

import os
import re
from functools import lru_cache
from pathlib import Path

CORPUS_PATH = Path(os.getenv("IJAZAH_QURAN_CORPUS_PATH", "/data/quran-hafs.tsv"))
_ARABIC_MARKS = re.compile("[\\u0610-\\u061a\\u064b-\\u065f\\u0670\\u06d6-\\u06ed]")
_WHITESPACE = re.compile(r"\s+")


def normalize_reference(text: str) -> str:
    """Normalize whitespace and Quranic combining marks for comparison only."""
    text = _ARABIC_MARKS.sub("", text)
    return _WHITESPACE.sub(" ", text).strip()


@lru_cache(maxsize=4)
def _load_corpus(path_string: str, modified_ns: int, size: int) -> dict[tuple[int, int], str]:
    del modified_ns, size  # Values are cache-key invalidators.
    path = Path(path_string)
    if not path.is_file():
        raise FileNotFoundError("trusted_quran_corpus_missing")
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


def get_corpus() -> dict[tuple[int, int], str]:
    path = CORPUS_PATH
    try:
        stat = path.stat()
        return _load_corpus(str(path), stat.st_mtime_ns, stat.st_size)
    except FileNotFoundError:
        raise


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
    except (FileNotFoundError, ValueError, OSError):
        return False
    trusted = corpus.get((surah, ayah))
    if trusted is None:
        return False
    return normalize_reference(supplied_text) == normalize_reference(trusted)
