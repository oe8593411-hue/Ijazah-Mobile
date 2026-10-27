# Ijazah Acoustic Tajweed Engine — prototype

This is the first project-owned acoustic model and private-service scaffold. It is not yet a trained or validated tajweed model.

## Included
- Private FastAPI inference endpoint with server-side bearer-token authentication.
- Audio decoding, mono conversion, 16 kHz resampling, and file/duration/silence checks.
- Ijazah-owned CNN architecture for a narrow, first task: annotated qalqalah audio segments.
- Supervised training script with teacher-review requirements and reciter-level train/validation separation.
- Fail-closed behavior: without reviewed model weights and trusted word timestamps, the service emits no tajweed findings.

## Local run
Install requirements, set `IJAZAH_TAJWEED_ENGINE_TOKEN` to a long random secret, then run:

```bash
uvicorn tajweed_engine.api:app --host 127.0.0.1 --port 8080
```

`GET /health` should say `model_not_trained` until a reviewed checkpoint exists.

## Dataset manifest
Each JSONL line needs `audio_path`, `start_ms`, `end_ms`, `label` (0=acceptable, 1=teacher-confirmed review candidate), `rule_id`=`qalqalah`, `split` (`train` or `validation`), `teacher_reviewed`=true, and `reciter_id`. Example:

```json
{"audio_path":"segments/clip01.wav","start_ms":1200,"end_ms":2050,"label":0,"rule_id":"qalqalah","split":"train","teacher_reviewed":true,"reciter_id":"reader-001"}
```

Use recordings licensed for model training and obtain any needed permissions. Define annotation criteria with qualified tajweed teachers. Keep each reciter in one split. A truly independent test set must remain untouched by training and model selection.

```bash
python train.py --manifest data/manifest.jsonl --data-root data --output models/qalqalah_classifier.pt
```

The resulting checkpoint is deliberately marked `teacher_reviewed=false` and cannot load in the API. A teacher audit and confidence calibration must be performed independently; do not simply change the flag to force loading.

## Integration gap
The current app sends textual rule candidates but not word-level audio timestamps. The service will not guess where a word occurs in the recording. Before end-to-end findings can work, add and validate audio-to-word alignment and pass trusted `startMs`/`endMs` values. Do not treat speech-to-text alignment as proof of a tajweed mistake.

## Deployment and security
Run this Python/PyTorch service separately from the Expo/Vercel frontend. Configure the same strong `IJAZAH_TAJWEED_ENGINE_TOKEN` only in server-side secret settings. Do not expose it in browser/mobile code. Production also requires authentication, shared rate limits, concurrency controls, privacy/retention policy, and monitoring.
