from __future__ import annotations
import hmac, json, os, math
from pathlib import Path
from typing import Any
import torch
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from .audio import decode_audio, log_mel
from .model import AcousticRuleClassifier
from .reference import get_corpus, validate_reference

app = FastAPI(title="Ijazah Acoustic Tajweed Engine", version="0.2.0")
TOKEN = os.getenv("IJAZAH_TAJWEED_ENGINE_TOKEN", "")
MODEL_PATH = Path(os.getenv("IJAZAH_ENGINE_MODEL_DIR", "/models")) / "qalqalah_classifier.pt"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = None
metadata: dict[str, Any] = {}

def load_model():
    global model, metadata
    if not MODEL_PATH.is_file():
        return
    try:
        checkpoint = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=True)
        info = checkpoint.get("metadata", {})
        threshold = info.get("decision_threshold")
        if (info.get("task") != "qalqalah_segment_v1" or info.get("teacher_reviewed") is not True
            or info.get("calibrated") is not True or not isinstance(threshold, (int, float))
            or isinstance(threshold, bool) or not math.isfinite(threshold) or not 0 < threshold <= 1):
            return
        candidate = AcousticRuleClassifier()
        candidate.load_state_dict(checkpoint["state_dict"], strict=True)
        candidate.to(DEVICE).eval()
        model, metadata = candidate, info
    except Exception:
        model, metadata = None, {}

@app.on_event("startup")
def startup():
    load_model()

def authorize(value: str | None):
    if not TOKEN:
        raise HTTPException(status_code=503, detail="engine_secret_not_configured")
    supplied = (value or "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(supplied, TOKEN):
        raise HTTPException(status_code=401, detail="unauthorized")

def validate_rule_checks(
    checks: Any, duration_ms: float, reference_word_count: int | None = None
) -> list[dict[str, Any]]:
    """Accept finite, bounded timestamps and word positions only."""
    if not isinstance(checks, list) or len(checks) > 500:
        raise HTTPException(status_code=400, detail="invalid_rule_checks")
    validated: list[dict[str, Any]] = []
    for item in checks:
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail="invalid_rule_check")
        # Ignore other rule types, but strictly validate any qalqalah candidate.
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
        validated.append(item)
    return validated

@app.get("/health")
def health():
    try:
        corpus_size = len(get_corpus())
        corpus_ready = True
    except (FileNotFoundError, ValueError, OSError):
        corpus_size = 0
        corpus_ready = False
    return {
        "status": "alignment_not_configured" if corpus_ready else "trusted_quran_corpus_not_configured",
        "model_loaded": model is not None,
        "reference_corpus_ready": corpus_ready,
        "reference_corpus_ayahs": corpus_size,
        "trusted_server_alignment": False,
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

    # Client-provided timestamps are untrusted input, not acoustic alignment evidence.
    # The server-side forced aligner is not implemented yet, so fail closed even if
    # a caller submits plausible timestamps or a reviewed model is present.
    candidates = validate_rule_checks(checks, quality["duration_seconds"] * 1000, len(referenceText.split()))
    return {
        "status": "not_configured",
        "rulesEvaluated": [],
        "findings": [],
        "message": "لم تُفعّل المحاذاة الصوتية الداخلية الموثوقة بعد؛ لم نصدر أحكام تجويد.",
        "diagnostics": {
            "audioQuality": quality,
            "modelLoaded": model is not None,
            "clientCandidatesReceived": len(candidates),
            "trustedServerAlignment": False,
        },
    }
