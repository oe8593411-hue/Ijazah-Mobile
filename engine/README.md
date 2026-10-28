# Ijazah Acoustic Tajweed Engine — prototype

This is an Ijazah-owned acoustic-model scaffold for a narrow first research task: identifying possible qalqalah issues in teacher-annotated audio segments. It is not yet a trained or validated tajweed model.

## Included
- FastAPI service with server-side bearer-token authentication.
- Audio decoding, mono conversion, 16 kHz resampling, and file/duration/silence checks; FFmpeg fallback for mobile audio containers when `soundfile` cannot decode them, with a separate duration probe and bounded output.
- CNN model architecture and supervised training script.
- Strict manifest checks and separate reciter groups for training, validation, and held-out test.
- Fail-closed model loading: the API requires both independent teacher review and calibration metadata.
- The API fails closed: client-supplied timestamps are never treated as trusted alignment evidence.
- Strict validation rejects missing, reversed, non-finite, boolean, and out-of-audio timestamp boundaries; malformed candidate objects are rejected.

## Local run
Install requirements, set `IJAZAH_TAJWEED_ENGINE_TOKEN` to a long random secret, and point the corpus path at the versioned app JSON. From the repository root:

```bash
pip install -r engine/requirements.txt
export IJAZAH_TAJWEED_ENGINE_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"
export IJAZAH_QURAN_CORPUS_PATH="$PWD/src/quran/verified-corpus.json"
PYTHONPATH=engine uvicorn tajweed_engine.api:app --app-dir engine --host 127.0.0.1 --port 8080
```

`GET /health` reports whether the full reference corpus loaded and separately shows `trusted_server_alignment: false`. Until a trusted server-side audio-to-word aligner is integrated, analysis intentionally returns no tajweed findings. Keep the service on a private network during development.

## Dataset manifest

Each JSONL line is one teacher-reviewed audio segment and requires:
- `audio_path`: path to a permitted audio file under `--data-root`
- `start_ms`, `end_ms`: reviewed segment boundaries in milliseconds
- `label`: 0=acceptable segment, 1=teacher-confirmed review candidate
- `rule_id`: `qalqalah`
- `split`: `train`, `validation`, or `test`
- `teacher_reviewed`: `true`
- `recording_id`: pseudonymous clip identifier
- `reciter_id`: stable pseudonymous voice identifier, kept disjoint across splits
- `rights`: license/permission reference plus explicit training-rights and speaker-consent confirmations
- `reviewers`: at least two distinct teacher IDs, each with a binary label and ISO date
- `adjudication`: required only when the first reviewers disagree; must name a third, independent teacher and the final label

Example with two teachers in agreement:

```json
{"audio_path":"segments/clip01.wav","start_ms":1200,"end_ms":2050,"label":0,"rule_id":"qalqalah","split":"train","teacher_reviewed":true,"recording_id":"session-001-clip-01","reciter_id":"reader-001","rights":{"license":"written_permission","reference":"permission-record-001","training_rights_confirmed":true,"consent_confirmed":true},"reviewers":[{"reviewer_id":"teacher-a","label":0,"reviewed_at":"2026-10-01"},{"reviewer_id":"teacher-b","label":0,"reviewed_at":"2026-10-02"}]}
```

The trainer rejects missing licensing/permission evidence, missing reciter consent, fewer than two independent teachers, duplicate reviewer IDs, invalid dates, consensus mismatches, or disagreements without a third-teacher adjudication. Use actual records; the example above is a schema illustration, not a real annotated recording. The same reciter must not appear in more than one split, and each split must contain both labels. Do not train from unlicensed recordings or synthetic labels. Qualified tajweed teachers must define annotation criteria and review labels.

```bash
python train.py --manifest data/manifest.jsonl --data-root data --output models/qalqalah_classifier.pt
```

The output is a research checkpoint with `teacher_reviewed=false` and `calibrated=false`, so the API deliberately refuses to load it. Do not change these flags just to force deployment. Independent audit and confidence calibration must be completed and documented before a release checkpoint can be produced.

## Trusted Quran reference corpus

The engine uses the application's existing versioned source, `src/quran/verified-corpus.json`, containing Tanzil Uthmani 1.1 / Hafs. The Docker image copies this exact source to `/data/verified-corpus.json` and sets `IJAZAH_QURAN_CORPUS_PATH` to that file. The engine checks the exact repository-blob fingerprint of the JSON file, corpus metadata, pinned upstream SHA-256, all 114 surahs, all 6,236 ayahs, and the expected ayah count for each surah before accepting any request. Any approved corpus update must deliberately update the pinned file fingerprint and its tests. A missing, malformed, incomplete, or differently identified corpus fails closed.

Build the image **from the repository root** (the build context must include `src/quran/verified-corpus.json`):

```bash
docker build -f engine/Dockerfile -t ijazah-tajweed-engine .
```

Configure `IJAZAH_TAJWEED_ENGINE_TOKEN` as a long random server-side secret when running the container. Never expose it to the browser or mobile app. The corpus source attribution and verification notes are included in the image at `/data/SOURCE_ATTRIBUTION.md`.

A tab-separated TSV corpus is still accepted for isolated local tests or separately managed deployments, using one ayah per line: `surah<TAB>ayah<TAB>exact Uthmani ayah text`. The default production image uses the strict, versioned JSON corpus from the app; do not replace it with generated or unverified text.

## Critical integration gap
The mobile app currently provides textual rule candidates and can submit timestamps, but client-supplied timestamps are untrusted and are not used to issue findings. The API deliberately returns no findings until a server-side, validated audio-to-word alignment stage is integrated. Text transcription or alignment alone is not evidence that a tajweed rule was violated.

## Deployment and security
Deploy this Python/PyTorch service separately from the Expo/Vercel frontend on a container-capable host. Configure `IJAZAH_TAJWEED_ENGINE_TOKEN` only as a server-side secret; never include it in browser or mobile code. Before real users: add authenticated caller identity, shared rate limiting, concurrency limits, request logging without raw audio, a privacy/retention policy, and monitoring. The current in-memory app scaffold is not production-ready.

## Current status
Architecture and safeguards exist; no reviewed dataset or trained release model is included. Therefore this repository must not claim production tajweed detection accuracy.
