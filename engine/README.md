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

## Local CTC word-alignment integration

The engine now contains a local CTC Viterbi forced aligner. It aligns characters in the already-verified ayah text to frame-level probabilities produced by an **Ijazah-controlled TorchScript model**. It does not send audio to a third-party API and does not transcribe unknown speech. The CTC model weights are not included; without a trained, reviewed, calibrated model the API correctly refuses to produce word timings or tajweed findings.

The model directory must contain both files below before the aligner can load:

- `/models/quran_ctc_aligner.pt`: locally trained TorchScript model. Input is a log-mel tensor shaped `[1, 1, 80, frames]`; output is logits shaped `[1, frames, classes]`.
- `/models/quran_ctc_aligner.json`: metadata matching the following contract. `vocabulary` maps each single normalized Quranic character to a unique integer ID; the blank ID is the remaining class ID. The model hash is SHA-256 of the exact `.pt` file.

```json
{
  "task": "quran_ctc_character_alignment_v1",
  "teacher_reviewed": true,
  "calibrated": true,
  "alignment_quality_passed": true,
  "sample_rate": 16000,
  "frame_hop_samples": 160,
  "blank_id": 0,
  "vocabulary": {"ا": 1, "ب": 2},
  "minimum_mean_character_confidence": 0.75,
  "model_sha256": "<sha256-of-the-trained-model-file>"
}
```

The JSON is a schema example, not an operational model configuration. **Never copy the review/calibration flags into production metadata until independent teachers and held-out tests have actually passed.** The loader checks those gates, vocabulary IDs, model hash, output shape, reference coverage and confidence; missing or invalid artifacts fail closed. When alignment weights are absent, client-supplied timestamps still cannot create findings. When only the aligner is available, the API can return aligned words but will not evaluate tajweed until the separately reviewed qalqalah classifier is also configured.


### Training the local alignment model

Use only recordings with explicit training permission and reciter consent. Each manifest line identifies a surah and a contiguous ayah range; transcript strings are not accepted from the manifest. The trainer takes exact text from the pinned Quran corpus, checks independent teacher confirmations of the recording/reference pairing, and requires train/validation/test splits with separate reciters and recordings.

Required fields: audio_path, surah, ayah_start, ayah_end, split, teacher_reviewed, recording_id, reciter_id, rights, and reviewers. The rights object must include license, reference, training_rights_confirmed=true, and consent_confirmed=true. At least two different reviewers must each provide reference_confirmed=true and an ISO review date.

Example schema (permission references and reviews must correspond to real records):
```json
{"audio_path":"clips/reader001-fatiha.wav","surah":1,"ayah_start":1,"ayah_end":1,"split":"train","teacher_reviewed":true,"recording_id":"clip-001","reciter_id":"reader-001","rights":{"license":"written_permission","reference":"permission-record-001","training_rights_confirmed":true,"consent_confirmed":true},"reviewers":[{"reviewer_id":"teacher-a","reference_confirmed":true,"reviewed_at":"2026-10-01"},{"reviewer_id":"teacher-b","reference_confirmed":true,"reviewed_at":"2026-10-02"}]}
```

From the repository root, validate a real manifest first and then train:
```bash
export IJAZAH_QURAN_CORPUS_PATH="$PWD/src/quran/verified-corpus.json"
PYTHONPATH=engine python engine/train_aligner.py --manifest data/aligner-manifest.jsonl --data-root data --validate-only
PYTHONPATH=engine python engine/train_aligner.py --manifest data/aligner-manifest.jsonl --data-root data --output-dir models --epochs 20 --batch-size 2
```

The trainer chooses a checkpoint by validation CTC loss and measures the held-out test loss after selection. It writes a TorchScript model and its SHA-256 sidecar into the output directory; mount that directory at /models in the container or set IJAZAH_ENGINE_MODEL_DIR to the mounted path. It deliberately leaves teacher_reviewed, calibrated, and alignment_quality_passed set to false. Those flags must not be changed just because training completed; independent alignment-quality review and confidence calibration are still required before the API will load the model.


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
python train.py --manifest data/manifest.jsonl --data-root data --validate-only
# After validation succeeds, run the research training:
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

A tab-separated TSV corpus is accepted only when `IJAZAH_ALLOW_UNPINNED_TSV=true` is explicitly set, for isolated local tests or separately managed deployments; each line contains `surah<TAB>ayah<TAB>exact Uthmani ayah text`. The production Docker image pins this flag to `false` and uses the exact versioned JSON corpus from the app. Never enable unpinned TSV loading in production or replace the reference with generated/unverified text.

## Critical integration gap
The mobile app can submit textual rule candidates and timestamps, but client timestamps are stripped and never used as alignment evidence. The local CTC alignment algorithm and supervised training path are now present; no trained alignment weights or reviewed qalqalah checkpoint are included, so production findings remain disabled until the required release gates pass. Text transcription or alignment alone is not evidence that a tajweed rule was violated.

## Deployment and security
Deploy this Python/PyTorch service separately from the Expo/Vercel frontend on a container-capable host. Configure `IJAZAH_TAJWEED_ENGINE_TOKEN` only as a server-side secret; never include it in browser or mobile code. Before real users: add authenticated caller identity, shared rate limiting, concurrency limits, request logging without raw audio, a privacy/retention policy, and monitoring. The current in-memory app scaffold is not production-ready.

## Current status
Architecture and safeguards exist; no reviewed dataset or trained release model is included. Therefore this repository must not claim production tajweed detection accuracy.
