from __future__ import annotations

import hashlib
import hmac
import json
import math
import os
from pathlib import Path
from typing import Any

import numpy as np
import torch
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

from .alignment import (
    AlignmentConfidenceError,
    AlignmentError,
    align_reference_words,
    validate_aligner_metadata,
)
from .audio import SAMPLE_RATE, decode_audio, log_mel
from .model import AcousticRuleClassifier
from .reference import get_corpus, normalize_reference, validate_reference

app = FastAPI(title="Ijazah Acoustic Tajweed Engine", version="0.3.0")
TOKEN = os.getenv("IJAZAH_TAJWEED_ENGINE_TOKEN", "")
MODEL_DIR = Path(os.getenv("IJAZAH_ENGINE_MODEL_DIR", "/models"))
MODEL_PATH = MODEL_DIR / "qalqalah_classifier.pt"
ALIGNER_PATH = MODEL_DIR / "quran_ctc_aligner.pt"
ALIGNER_METADATA_PATH = MODEL_DIR / "quran_ctc_aligner.json"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = None
metadata: dict[str, Any] = {}
aligner = None
aligner_metadata: dict[str, Any] = {}


def load_model():
    global model, metadata
    model, metadata = None, {}
    if not MODEL_PATH.is_file():
        return
    try:
        checkpoint = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=True)
        info = checkpoint.get("metadata", {})
        threshold = info.get("decision_threshold")
        if (
            info.get("task") != "qalqalah_segment_v1"
            or info.get("teacher_reviewed") is not True
            or info.get("calibrated") is not True
            or info.get("validation_threshold_meets_minimum_precision") is not True
            or not isinstance(threshold, (int, float))
            or isinstance(threshold, bool)
            or not math.isfinite(threshold)
            or not 0 < threshold <= 1
        ):
            return
        candidate = AcousticRuleClassifier()
        candidate.load_state_dict(checkpoint["state_dict"], strict=True)
        candidate.to(DEVICE).eval()
        model, metadata = candidate, info
    except Exception:
        model, metadata = None, {}


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_aligner():
    """Load only a local, hash-pinned TorchScript aligner with completed release gates."""
    global aligner, aligner_metadata
    aligner, aligner_metadata = None, {}
    if not ALIGNER_PATH.is_file() or not ALIGNER_METADATA_PATH.is_file():
        return
    try:
        if ALIGNER_METADATA_PATH.stat().st_size > 5 * 1024 * 1024:
            return
        info = json.loads(ALIGNER_METADATA_PATH.read_text(encoding="utf-8"))
        validate_aligner_metadata(info)
        if not hmac.compare_digest(_sha256_file(ALIGNER_PATH), info["model_sha256"]):
            return
        candidate = torch.jit.load(str(ALIGNER_PATH), map_location=DEVICE)
        candidate.eval()
        aligner, aligner_metadata = candidate, info
    except Exception:
        aligner, aligner_metadata = None, {}


@app.on_event("startup")
def startup():
    load_model()
    load_aligner()


def authorize(value: str | None):
    if not TOKEN:
        raise HTTPException(status_code=503, detail="engine_secret_not_configured")
    supplied = (value or "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(supplied, TOKEN):
        raise HTTPException(status_code=401, detail="unauthorized")


def validate_rule_checks(
    checks: Any, duration_ms: float, reference_word_count: int | None = None
) -> list[dict[str, Any]]:
    """Validate the client's candidate shape; its timestamps are never trusted."""
    if not isinstance(checks, list) or len(checks) > 500:
        raise HTTPException(status_code=400, detail="invalid_rule_checks")
    validated: list[dict[str, Any]] = []
    for item in checks:
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail="invalid_rule_check")
        if item.get("ruleId") != "qalqalah":
            continue
        start, end, word_index = item.get("startMs"), item.get("endMs"), item.get("wordIndex")
        if (
            isinstance(start, bool) or isinstance(end, bool) or isinstance(word_index, bool)
            or not isinstance(start, (int, float)) or not isinstance(end, (int, float))
            or not isinstance(word_index, int) or word_index < 0 or word_index > 10_000
        ):
            raise HTTPException(status_code=400, detail="invalid_rule_check_timestamps")
        try:
            start_ms, end_ms = float(start), float(end)
        except (OverflowError, ValueError, TypeError) as exc:
            raise HTTPException(status_code=400, detail="invalid_rule_check_timestamps") from exc
        if (
            not math.isfinite(start_ms) or not math.isfinite(end_ms)
            or start_ms < 0 or end_ms <= start_ms or end_ms > duration_ms
            or (reference_word_count is not None and word_index >= reference_word_count)
        ):
            raise HTTPException(status_code=400, detail="invalid_rule_check_timestamps")
        validated.append({"ruleId": "qalqalah", "wordIndex": word_index})
    return validated


def align_audio_to_reference(audio: np.ndarray, reference_text: str) -> dict[str, Any]:
    """Run the configured local CTC model and force-align trusted reference characters."""
    if aligner is None or not aligner_metadata:
        raise AlignmentError("aligner_not_configured")

    normalized = normalize_reference(reference_text)
    vocabulary = aligner_metadata["vocabulary"]
    missing = sorted({character for character in normalized if not character.isspace()
                      and character not in vocabulary})
    if missing:
        raise AlignmentError("aligner_vocabulary_missing_character")

    features = log_mel(np.ascontiguousarray(audio, dtype=np.float32)).to(DEVICE)
    with torch.inference_mode():
        logits = aligner(features)
    if (
        not torch.is_tensor(logits) or logits.ndim != 3 or logits.shape[0] != 1
        or logits.shape[1] != features.shape[-1]
        or logits.shape[2] != len(vocabulary) + 1
        or not torch.isfinite(logits).all()
    ):
        raise AlignmentError("aligner_model_output_invalid")

    log_probabilities = torch.log_softmax(logits[0].float(), dim=-1).cpu().numpy()
    hop = aligner_metadata["frame_hop_samples"]
    if log_probabilities.shape[0] > math.ceil(len(audio) / hop) + 8:
        raise AlignmentError("aligner_frame_count_exceeds_audio")
    return align_reference_words(
        log_probabilities,
        reference_text,
        vocabulary,
        aligner_metadata["blank_id"],
        sample_rate=aligner_metadata["sample_rate"],
        frame_hop_samples=hop,
        duration_ms=len(audio) * 1000.0 / SAMPLE_RATE,
        minimum_mean_character_confidence=aligner_metadata["minimum_mean_character_confidence"],
    )


def score_aligned_candidates(
    audio: np.ndarray, words: list[dict[str, Any]], candidates: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Score only server-aligned word windows; ignore client timing values entirely."""
    if model is None:
        return []
    findings: list[dict[str, Any]] = []
    seen: set[tuple[str, int]] = set()
    duration_samples = len(audio)
    window_samples = SAMPLE_RATE * 4
    threshold = float(metadata["decision_threshold"])

    for candidate in candidates:
        rule_id = candidate["ruleId"]
        word_index = candidate["wordIndex"]
        key = (rule_id, word_index)
        if key in seen:
            continue
        seen.add(key)
        word = words[word_index]

        # Expand server-side alignment by 120 ms on each side, then match the
        # four-second right-padded window used by the supervised training script.
        start_ms = max(0.0, float(word["startMs"]) - 120.0)
        end_ms = min(duration_samples * 1000.0 / SAMPLE_RATE,
                     float(word["endMs"]) + 120.0)
        start_sample = max(0, int(math.floor(start_ms * SAMPLE_RATE / 1000.0)))
        end_sample = min(duration_samples, int(math.ceil(end_ms * SAMPLE_RATE / 1000.0)))
        if end_sample <= start_sample:
            continue
        segment = audio[start_sample:end_sample]
        segment = segment[:window_samples]
        window = np.zeros(window_samples, dtype=np.float32)
        window[:len(segment)] = segment

        features = log_mel(window).to(DEVICE)
        with torch.inference_mode():
            logits = model(features)
            if (
                not torch.is_tensor(logits) or logits.shape != (1, 2)
                or not torch.isfinite(logits).all()
            ):
                raise HTTPException(status_code=503, detail="tajweed_model_output_invalid")
            confidence = float(torch.softmax(logits.float(), dim=-1)[0, 1].item())
        if not math.isfinite(confidence):
            raise HTTPException(status_code=503, detail="tajweed_model_output_invalid")
        if confidence >= threshold:
            findings.append({
                "ruleId": rule_id,
                "wordIndex": word_index,
                "word": word["word"],
                "startMs": word["startMs"],
                "endMs": word["endMs"],
                "confidence": round(confidence, 4),
                "status": "review_candidate",
            })
    return findings


@app.get("/health")
def health():
    try:
        corpus_size = len(get_corpus())
        corpus_ready = True
    except (FileNotFoundError, ValueError, OSError):
        corpus_size = 0
        corpus_ready = False

    if not corpus_ready:
        status = "trusted_quran_corpus_not_configured"
    elif aligner is None:
        status = "alignment_not_configured"
    elif model is None:
        status = "aligner_ready_model_not_configured"
    else:
        status = "ready"

    return {
        "status": status,
        "model_loaded": model is not None,
        "ctc_aligner_loaded": aligner is not None,
        "reference_corpus_ready": corpus_ready,
        "reference_corpus_ayahs": corpus_size,
        "trusted_server_alignment": aligner is not None,
        "trusted_analysis_ready": corpus_ready and aligner is not None and model is not None,
    }


@app.post("/v1/analyze")
async def analyze(
    file: UploadFile = File(...), surah: int = Form(...), ayah: int = Form(...),
    riwaya: str = Form(...), referenceText: str = Form(...),
    expectedRuleChecks: str = Form(...), authorization: str | None = Header(default=None),
):
    authorize(authorization)
    if not (1 <= surah <= 114 and ayah >= 1) or riwaya != "hafs":
        raise HTTPException(status_code=400, detail="invalid_reference")
    if not referenceText.strip():
        raise HTTPException(status_code=400, detail="missing_reference_text")
    try:
        get_corpus()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail="trusted_quran_corpus_not_configured") from exc
    except (ValueError, OSError) as exc:
        raise HTTPException(status_code=503, detail="trusted_quran_corpus_invalid") from exc
    if not validate_reference(surah, ayah, referenceText):
        raise HTTPException(status_code=400, detail="reference_text_mismatch")
    try:
        checks = json.loads(expectedRuleChecks)
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=400, detail="invalid_rule_checks") from exc

    raw = await file.read(20 * 1024 * 1024 + 1)
    if len(raw) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="audio_too_large")
    try:
        audio, quality = decode_audio(raw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    candidates = validate_rule_checks(
        checks, quality["duration_seconds"] * 1000, len(normalize_reference(referenceText).split())
    )

    if aligner is None:
        # Client timestamps never become alignment evidence.
        return {
            "status": "not_configured",
            "rulesEvaluated": [],
            "findings": [],
            "message": "لم تُجهّز أوزان المحاذاة الصوتية الداخلية المعتمدة بعد.",
            "diagnostics": {
                "audioQuality": quality,
                "modelLoaded": model is not None,
                "ctcAlignerLoaded": False,
                "clientCandidatesReceived": len(candidates),
                "trustedServerAlignment": False,
            },
        }

    try:
        alignment = align_audio_to_reference(audio, referenceText)
    except AlignmentConfidenceError as exc:
        return {
            "status": "alignment_low_confidence",
            "rulesEvaluated": [],
            "findings": [],
            "message": "لم نتوصل إلى محاذاة صوتية موثوقة لهذا التسجيل.",
            "diagnostics": {
                "audioQuality": quality,
                "modelLoaded": model is not None,
                "ctcAlignerLoaded": True,
                "meanCharacterConfidence": round(exc.confidence, 4),
                "trustedServerAlignment": False,
            },
        }
    except AlignmentError as exc:
        detail = (
            "aligner_vocabulary_incomplete"
            if "vocabulary_missing_character" in str(exc)
            else "trusted_alignment_failed"
        )
        raise HTTPException(status_code=503, detail=detail) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="trusted_alignment_failed") from exc

    if model is None:
        return {
            "status": "alignment_ready_model_not_configured",
            "rulesEvaluated": [],
            "findings": [],
            "alignedWords": alignment["words"],
            "message": "تم تحديد مواقع الكلمات، لكن نموذج تقييم القلقلة المعتمد غير مهيأ.",
            "diagnostics": {
                "audioQuality": quality,
                "modelLoaded": False,
                "ctcAlignerLoaded": True,
                "meanCharacterConfidence": alignment["meanCharacterConfidence"],
                "trustedServerAlignment": True,
            },
        }

    try:
        findings = score_aligned_candidates(audio, alignment["words"], candidates)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="trusted_tajweed_scoring_failed") from exc
    return {
        "status": "ok",
        "rulesEvaluated": sorted({candidate["ruleId"] for candidate in candidates}),
        "findings": findings,
        "alignedWords": alignment["words"],
        "message": "اكتمل التحليل باستخدام المحاذاة الصوتية الداخلية.",
        "diagnostics": {
            "audioQuality": quality,
            "modelLoaded": True,
            "ctcAlignerLoaded": True,
            "meanCharacterConfidence": alignment["meanCharacterConfidence"],
            "trustedServerAlignment": True,
        },
    }
