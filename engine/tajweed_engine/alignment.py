from __future__ import annotations

import math
import re
from typing import Any

import numpy as np

from .reference import normalize_reference


class AlignmentError(ValueError):
    """The local CTC model or its reference text cannot be safely aligned."""


class AlignmentConfidenceError(AlignmentError):
    """The forced path failed the configured alignment-confidence gate."""

    def __init__(self, confidence: float):
        super().__init__("alignment_confidence_below_threshold")
        self.confidence = confidence


def validate_aligner_metadata(metadata: Any) -> None:
    """Validate release gates and the local character-vocabulary contract."""
    if not isinstance(metadata, dict):
        raise ValueError("aligner_metadata_invalid")

    if (
        metadata.get("task") != "quran_ctc_character_alignment_v1"
        or metadata.get("teacher_reviewed") is not True
        or metadata.get("calibrated") is not True
        or metadata.get("alignment_quality_passed") is not True
    ):
        raise ValueError("aligner_release_gate_not_passed")

    sample_rate = metadata.get("sample_rate")
    hop = metadata.get("frame_hop_samples")
    blank_id = metadata.get("blank_id")
    if (
        isinstance(sample_rate, bool) or sample_rate != 16000
        or isinstance(hop, bool) or not isinstance(hop, int) or not 1 <= hop <= 1600
        or isinstance(blank_id, bool) or not isinstance(blank_id, int) or blank_id < 0
    ):
        raise ValueError("aligner_audio_contract_invalid")

    threshold = metadata.get("minimum_mean_character_confidence")
    if (
        isinstance(threshold, bool) or not isinstance(threshold, (int, float))
        or not math.isfinite(threshold) or not 0 < threshold <= 1
    ):
        raise ValueError("aligner_confidence_gate_invalid")

    model_sha256 = metadata.get("model_sha256")
    if not isinstance(model_sha256, str) or re.fullmatch(r"[0-9a-f]{64}", model_sha256) is None:
        raise ValueError("aligner_model_hash_invalid")

    vocabulary = metadata.get("vocabulary")
    if not isinstance(vocabulary, dict) or not vocabulary:
        raise ValueError("aligner_vocabulary_invalid")

    ids: list[int] = []
    for character, token_id in vocabulary.items():
        if (
            not isinstance(character, str) or len(character) != 1
            or character.isspace()
            or isinstance(token_id, bool) or not isinstance(token_id, int)
            or token_id < 0
        ):
            raise ValueError("aligner_vocabulary_entry_invalid")
        ids.append(token_id)

    if len(set(ids)) != len(ids) or blank_id in ids:
        raise ValueError("aligner_vocabulary_ids_invalid")
    if set(ids) | {blank_id} != set(range(len(ids) + 1)):
        raise ValueError("aligner_vocabulary_ids_must_be_dense")


def ctc_viterbi_align(
    log_probabilities: np.ndarray,
    token_ids: list[int],
    blank_id: int,
) -> list[dict[str, float | int]]:
    """Align a known character sequence to CTC frame log-probabilities.

    The dynamic program searches the best legal CTC path. Returned frame ranges
    use an inclusive start and exclusive end. This function does not transcribe
    audio: it aligns only a reference sequence supplied by the trusted caller.
    """
    values = np.asarray(log_probabilities, dtype=np.float64)
    if values.ndim != 2:
        raise AlignmentError("ctc_output_must_be_2d")
    frame_count, class_count = values.shape
    if not 1 <= frame_count <= 12000 or not token_ids or len(token_ids) > 600:
        raise AlignmentError("ctc_sequence_length_invalid")
    if (
        isinstance(blank_id, bool) or not isinstance(blank_id, int)
        or not 0 <= blank_id < class_count
    ):
        raise AlignmentError("ctc_blank_id_invalid")
    if any(
        isinstance(token, bool) or not isinstance(token, int)
        or not 0 <= token < class_count or token == blank_id
        for token in token_ids
    ):
        raise AlignmentError("ctc_token_id_invalid")
    if not np.isfinite(values).all():
        raise AlignmentError("ctc_output_non_finite")

    row_log_norm = np.logaddexp.reduce(values, axis=1)
    if np.any(values > 1e-6) or np.any(np.abs(row_log_norm) > 0.1):
        raise AlignmentError("ctc_output_must_be_log_probabilities")

    state_labels = np.full(2 * len(token_ids) + 1, blank_id, dtype=np.int64)
    state_labels[1::2] = np.asarray(token_ids, dtype=np.int64)
    state_count = len(state_labels)

    previous = np.full(state_count, -np.inf, dtype=np.float64)
    previous[0] = values[0, blank_id]
    previous[1] = values[0, token_ids[0]]
    backpointers = np.zeros((frame_count, state_count), dtype=np.uint8)
    invalid_skip = (state_labels[2:] == blank_id) | (state_labels[2:] == state_labels[:-2])

    positions = np.arange(state_count)
    for frame in range(1, frame_count):
        advance = np.full(state_count, -np.inf, dtype=np.float64)
        advance[1:] = previous[:-1]
        skip = np.full(state_count, -np.inf, dtype=np.float64)
        skip[2:] = previous[:-2]
        skip_tail = skip[2:]
        skip_tail[invalid_skip] = -np.inf

        transitions = np.vstack((previous, advance, skip))
        choice = np.argmax(transitions, axis=0)
        best = transitions[choice, positions]
        previous = best + values[frame, state_labels]
        backpointers[frame] = choice.astype(np.uint8)

    final_states = (state_count - 1, state_count - 2)
    final_scores = np.asarray([previous[s] for s in final_states])
    selected = int(np.argmax(final_scores))
    if not np.isfinite(final_scores[selected]):
        raise AlignmentError("ctc_no_valid_alignment_path")

    state = final_states[selected]
    state_path = np.empty(frame_count, dtype=np.int64)
    for frame in range(frame_count - 1, 0, -1):
        state_path[frame] = state
        state -= int(backpointers[frame, state])
    state_path[0] = state
    if state_path[0] not in (0, 1):
        raise AlignmentError("ctc_backtrace_invalid")

    result: list[dict[str, float | int]] = []
    for token_index, token_id in enumerate(token_ids):
        token_state = 2 * token_index + 1
        frames = np.flatnonzero(state_path == token_state)
        if len(frames) == 0:
            raise AlignmentError("ctc_character_unaligned")
        token_confidence = float(np.exp(values[frames, token_id]).mean())
        result.append({
            "startFrame": int(frames[0]),
            "endFrame": int(frames[-1] + 1),
            "confidence": min(1.0, max(0.0, token_confidence)),
        })
    return result


def align_reference_words(
    log_probabilities: np.ndarray,
    reference_text: str,
    vocabulary: dict[str, int],
    blank_id: int,
    *,
    sample_rate: int = 16000,
    frame_hop_samples: int = 160,
    duration_ms: float,
    minimum_mean_character_confidence: float,
) -> dict[str, Any]:
    """Align every word of a trusted ayah and reject low-confidence paths."""
    normalized = normalize_reference(reference_text)
    words = normalized.split()
    if not words:
        raise AlignmentError("reference_text_empty")
    if (
        isinstance(sample_rate, bool) or not isinstance(sample_rate, int) or sample_rate <= 0
        or isinstance(frame_hop_samples, bool) or not isinstance(frame_hop_samples, int)
        or frame_hop_samples <= 0
        or not math.isfinite(duration_ms) or duration_ms <= 0
        or isinstance(minimum_mean_character_confidence, bool)
        or not isinstance(minimum_mean_character_confidence, (int, float))
        or not math.isfinite(minimum_mean_character_confidence)
        or not 0 < minimum_mean_character_confidence <= 1
    ):
        raise AlignmentError("alignment_contract_invalid")

    characters: list[str] = []
    word_ranges: list[tuple[int, int, str]] = []
    for word in words:
        start = len(characters)
        characters.extend(word)
        word_ranges.append((start, len(characters), word))
    if len(characters) > 600:
        raise AlignmentError("reference_too_long_to_align")

    missing = sorted({character for character in characters if character not in vocabulary})
    if missing:
        raise AlignmentError("aligner_vocabulary_missing_character")
    token_ids = [vocabulary[character] for character in characters]
    char_alignment = ctc_viterbi_align(log_probabilities, token_ids, blank_id)
    mean_confidence = float(np.mean([item["confidence"] for item in char_alignment]))
    if mean_confidence < minimum_mean_character_confidence:
        raise AlignmentConfidenceError(mean_confidence)

    words_alignment: list[dict[str, Any]] = []
    for word_index, (start, end, word) in enumerate(word_ranges):
        first = int(char_alignment[start]["startFrame"])
        last = int(char_alignment[end - 1]["endFrame"])
        start_ms = int(math.floor(first * frame_hop_samples * 1000 / sample_rate))
        end_ms = int(math.ceil(last * frame_hop_samples * 1000 / sample_rate))
        start_ms = max(0, min(start_ms, int(math.floor(duration_ms))))
        end_ms = max(0, min(end_ms, int(math.ceil(duration_ms))))
        if end_ms <= start_ms:
            raise AlignmentError("aligned_word_has_invalid_duration")
        word_confidence = float(np.mean([
            item["confidence"] for item in char_alignment[start:end]
        ]))
        words_alignment.append({
            "wordIndex": word_index,
            "word": word,
            "startMs": start_ms,
            "endMs": end_ms,
            "alignmentConfidence": round(word_confidence, 4),
        })

    return {
        "words": words_alignment,
        "meanCharacterConfidence": round(mean_confidence, 4),
    }
