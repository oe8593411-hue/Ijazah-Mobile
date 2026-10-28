# Ijazah Acoustic Tajweed Engine — prototype

This is an Ijazah-owned acoustic-model scaffold for a narrow first research task: identifying possible qalqalah issues in teacher-annotated audio segments. It is not yet a trained or validated tajweed model.

## Included
- FastAPI service with server-side bearer-token authentication.
- Audio decoding, mono conversion, 16 kHz resampling, and file/duration/silence checks.
- CNN model architecture and supervised training script.
- Strict manifest checks and separate reciter groups for training, validation, and held-out test.
- Fail-closed model loading: the API requires both independent teacher review and calibration metadata.
- The API fails closed: client-supplied timestamps are never treated as trusted alignment evidence.
- Strict validation rejects missing, reversed, non-finite, boolean, and out-of-audio timestamp boundaries; malformed candidate objects are rejected.

## Local run
Install requirements, set `IJAZAH_TAJWEED_ENGINE_TOKEN` to a long random secret, then run from this directory:

```bash
uvicorn tajweed_engine.api:app --host 127.0.0.1 --port 8080
```

`GET /health` should report `model_not_trained` until a reviewed, calibrated checkpoint exists. Keep the service on a private network during development.

## Dataset manifest
Each JSONL line requires:
- `audio_path`: path to a permitted audio file under `--data-root`
- `start_ms`, `end_ms`: teacher-checked segment boundaries in milliseconds
- `label`: 0=acceptable segment, 1=teacher-confirmed review candidate
- `rule_id`: `qalqalah`
- `split`: `train`, `validation`, or `test`
- `teacher_reviewed`: `true`
- `reciter_id`: stable pseudonymous ID, used to keep voices disjoint between splits

Example:

```json
{"audio_path":"segments/clip01.wav","start_ms":1200,"end_ms":2050,"label":0,"rule_id":"qalqalah","split":"train","teacher_reviewed":true,"reciter_id":"reader-001"}
```

The same reciter must not appear in more than one split, and each split must contain both labels. Use recordings licensed for model training and obtain any needed permissions. Qualified tajweed teachers must define annotation criteria and review labels.

```bash
python train.py --manifest data/manifest.jsonl --data-root data --output models/qalqalah_classifier.pt
```

The output is a research checkpoint with `teacher_reviewed=false` and `calibrated=false`, so the API deliberately refuses to load it. Do not change these flags just to force deployment. Independent audit and confidence calibration must be completed and documented before a release checkpoint can be produced.

## Critical integration gap
The mobile app currently provides textual rule candidates and can submit timestamps, but client-supplied timestamps are untrusted and are not used to issue findings. The API deliberately returns no findings until a server-side, validated audio-to-word alignment stage is integrated. Text transcription or alignment alone is not evidence that a tajweed rule was violated.

## Deployment and security
Deploy this Python/PyTorch service separately from the Expo/Vercel frontend on a container-capable host. Configure `IJAZAH_TAJWEED_ENGINE_TOKEN` only as a server-side secret; never include it in browser or mobile code. Before real users: add authenticated caller identity, shared rate limiting, concurrency limits, request logging without raw audio, a privacy/retention policy, and monitoring. The current in-memory app scaffold is not production-ready.

## Current status
Architecture and safeguards exist; no reviewed dataset or trained release model is included. Therefore this repository must not claim production tajweed detection accuracy.
