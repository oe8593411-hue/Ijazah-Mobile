from __future__ import annotations

from datetime import date
import math
from typing import Any


def _valid_label(value: Any) -> bool:
    return not isinstance(value, bool) and isinstance(value, int) and value in (0, 1)


def _valid_review_date(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def validate_label_provenance(row: dict[str, Any]) -> None:
    """Require rights, consent, and independent teacher review before training."""
    recording_id = row.get("recording_id")
    if not isinstance(recording_id, str) or not recording_id.strip():
        raise ValueError("recording_id_required")

    if row.get("teacher_reviewed") is not True:
        raise ValueError("teacher_reviewed_must_be_true")

    rights = row.get("rights")
    if not isinstance(rights, dict):
        raise ValueError("rights_record_required")
    for field in ("license", "reference"):
        value = rights.get(field)
        if not isinstance(value, str) or len(value.strip()) < 3:
            raise ValueError(f"rights_{field}_required")
    if rights.get("training_rights_confirmed") is not True:
        raise ValueError("training_rights_not_confirmed")
    if rights.get("consent_confirmed") is not True:
        raise ValueError("reciter_consent_not_confirmed")

    final_label = row.get("label")
    if not _valid_label(final_label):
        raise ValueError("invalid_final_label")

    reviewers = row.get("reviewers")
    if not isinstance(reviewers, list) or len(reviewers) < 2:
        raise ValueError("at_least_two_independent_reviewers_required")

    reviewer_ids: set[str] = set()
    review_labels: list[int] = []
    for index, review in enumerate(reviewers, 1):
        if not isinstance(review, dict):
            raise ValueError(f"invalid_reviewer_record:{index}")
        reviewer_id = review.get("reviewer_id")
        if not isinstance(reviewer_id, str) or len(reviewer_id.strip()) < 2:
            raise ValueError(f"invalid_reviewer_id:{index}")
        reviewer_id = reviewer_id.strip()
        if reviewer_id in reviewer_ids:
            raise ValueError("reviewers_must_be_independent")
        if not _valid_label(review.get("label")):
            raise ValueError(f"invalid_reviewer_label:{index}")
        if not _valid_review_date(review.get("reviewed_at")):
            raise ValueError(f"invalid_review_date:{index}")
        reviewer_ids.add(reviewer_id)
        review_labels.append(review["label"])

    observed_labels = set(review_labels)
    adjudication = row.get("adjudication")
    if len(observed_labels) == 1:
        if final_label != review_labels[0]:
            raise ValueError("final_label_must_match_reviewer_consensus")
        if adjudication is not None:
            raise ValueError("adjudication_only_allowed_for_disagreement")
        return

    if not isinstance(adjudication, dict):
        raise ValueError("disagreement_requires_independent_adjudication")
    adjudicator_id = adjudication.get("reviewer_id")
    if not isinstance(adjudicator_id, str) or len(adjudicator_id.strip()) < 2:
        raise ValueError("invalid_adjudicator_id")
    adjudicator_id = adjudicator_id.strip()
    if adjudicator_id in reviewer_ids:
        raise ValueError("adjudicator_must_be_independent")
    if not _valid_label(adjudication.get("label")) or adjudication["label"] != final_label:
        raise ValueError("final_label_must_match_adjudication")
    if not _valid_review_date(adjudication.get("reviewed_at")):
        raise ValueError("invalid_adjudication_date")


def validate_segment_timestamps(start_ms: Any, end_ms: Any, duration_ms: Any) -> None:
    """Reject non-finite, reversed, too-short, or out-of-recording segments."""
    values = (start_ms, end_ms, duration_ms)
    if any(isinstance(value, bool) or not isinstance(value, (int, float)) for value in values):
        raise ValueError("invalid_segment_timestamp_type")
    try:
        start, end, duration = (float(value) for value in values)
    except (OverflowError, ValueError, TypeError) as exc:
        raise ValueError("invalid_segment_timestamp_value") from exc
    if not all(math.isfinite(value) for value in (start, end, duration)):
        raise ValueError("invalid_segment_timestamp_value")
    if start < 0 or end <= start:
        raise ValueError("invalid_segment_timestamp_order")
    if duration <= 0 or end > duration:
        raise ValueError("segment_outside_recording")
    if end - start < 250:
        raise ValueError("segment_too_short")



def validate_transcript_provenance(row: dict[str, Any]) -> None:
    """Require explicit rights and two teachers confirming the audio/reference pairing."""
    recording_id = row.get("recording_id")
    if not isinstance(recording_id, str) or len(recording_id.strip()) < 2:
        raise ValueError("recording_id_required")
    reciter_id = row.get("reciter_id")
    if not isinstance(reciter_id, str) or len(reciter_id.strip()) < 2:
        raise ValueError("reciter_id_required")
    if row.get("teacher_reviewed") is not True:
        raise ValueError("teacher_reviewed_must_be_true")
    if row.get("split") not in ("train", "validation", "test"):
        raise ValueError("invalid_transcript_split")

    for field in ("surah", "ayah_start", "ayah_end"):
        value = row.get(field)
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError(f"invalid_transcript_reference:{field}")
    if (
        not 1 <= row["surah"] <= 114
        or row["ayah_start"] < 1
        or row["ayah_end"] < row["ayah_start"]
        or row["ayah_end"] - row["ayah_start"] > 29
    ):
        raise ValueError("invalid_transcript_reference_range")

    rights = row.get("rights")
    if not isinstance(rights, dict):
        raise ValueError("rights_record_required")
    for field in ("license", "reference"):
        value = rights.get(field)
        if not isinstance(value, str) or len(value.strip()) < 3:
            raise ValueError(f"rights_{field}_required")
    if rights.get("training_rights_confirmed") is not True:
        raise ValueError("training_rights_not_confirmed")
    if rights.get("consent_confirmed") is not True:
        raise ValueError("reciter_consent_not_confirmed")

    reviewers = row.get("reviewers")
    if not isinstance(reviewers, list) or len(reviewers) < 2:
        raise ValueError("at_least_two_independent_reviewers_required")
    reviewer_ids: set[str] = set()
    for index, review in enumerate(reviewers, 1):
        if not isinstance(review, dict):
            raise ValueError(f"invalid_reviewer_record:{index}")
        reviewer_id = review.get("reviewer_id")
        if not isinstance(reviewer_id, str) or len(reviewer_id.strip()) < 2:
            raise ValueError(f"invalid_reviewer_id:{index}")
        reviewer_id = reviewer_id.strip()
        if reviewer_id in reviewer_ids:
            raise ValueError("reviewers_must_be_independent")
        if review.get("reference_confirmed") is not True:
            raise ValueError(f"reviewer_did_not_confirm_reference:{index}")
        if not _valid_review_date(review.get("reviewed_at")):
            raise ValueError(f"invalid_review_date:{index}")
        reviewer_ids.add(reviewer_id)
