# Ijazah-Owned Acoustic Tajweed Engine Integration

## Selected architecture

Ijazah is building and operating its own narrow acoustic tajweed engine. The first research task is a qalqalah segment classifier trained on teacher-reviewed recordings. The Python service in `engine/` owns audio decoding, reference validation, model loading, and the API contract. It does not call an external tajweed SaaS or import a third-party tajweed model.

The CNN in `engine/tajweed_engine/model.py` is only an untrained architecture scaffold. It is not evidence of detection accuracy. The release gate intentionally rejects checkpoints unless the task identifier, independent teacher-review flag, and calibration metadata are present and valid.

## Verified Quran reference

The engine uses the app's pinned Tanzil Uthmani 1.1 / Hafs file, `src/quran/verified-corpus.json`. The container image copies that exact file to `/data/verified-corpus.json`. Before accepting a request, the engine checks the repository blob fingerprint, source metadata, upstream SHA-256, all 114 surahs, all 6,236 ayahs, and the expected ayah count for each surah. Corpus changes fail closed until the expected fingerprint and tests are deliberately updated.

## Current app contract

The Vercel endpoint `api/analyze-recitation.ts` can call the private engine using server-side environment variables:
- `IJAZAH_TAJWEED_ENGINE_URL`
- `IJAZAH_TAJWEED_ENGINE_TOKEN`

It sends the audio as multipart data alongside the selected Hafs reference and expected rule candidates. The engine validates the reference against the pinned Quran corpus and rejects malformed audio, unbounded timestamps, invalid word indices, and unauthenticated requests.

The current Python API **always returns `status: "not_configured"` and no findings** because trusted server-side audio-to-word alignment has not yet been implemented. The Vercel adapter must preserve that status; it must not turn an unconfigured response into a success or imply that no tajweed mistakes were found.

The separate transcription flow in `api/analyze-recitation.ts` may use speech-to-text providers for textual comparison, but text recognition is not acoustic tajweed detection. Text-only evidence, client-supplied timestamps, and an untrained classifier must never be presented as confirmed tajweed findings.

## Build and run

From the repository root:

```bash
docker build -f engine/Dockerfile -t ijazah-tajweed-engine .
```

Configure `IJAZAH_TAJWEED_ENGINE_TOKEN` only in the engine host's server-side environment. Configure `IJAZAH_TAJWEED_ENGINE_URL` and the matching token only in the Vercel server-side environment. Keep `IJAZAH_ANALYSIS_ENABLED` disabled until caller authentication, shared rate limits, and the operational privacy controls are ready.

## Release gates

1. Collect recordings with appropriate permissions and training rights; retain no raw audio longer than the stated privacy policy permits.
2. Obtain teacher-reviewed segment boundaries and labels for the narrow qalqalah task. Keep the same reciter wholly within one of train, validation, or held-out test.
3. Implement server-side phoneme/word alignment. Client-provided candidate timestamps are untrusted and cannot become evidence.
4. Evaluate on speaker-disjoint held-out recordings across voices, devices, noise conditions, and clean/annotated-error examples.
5. Require independent tajweed teacher review and calibrated confidence thresholds before producing a release checkpoint.
6. Keep all unsupported or ambiguous cases fail-closed. Only return findings tied to trusted-reference locations and measured acoustic evidence.
7. Verify the service's health endpoint, authentication, request limits, logs without raw audio, retention policy, and failure behavior before enabling any user-facing analysis.

## Status

The verified reference is packaged and validated, the API is hardened, and the existing CI runs the Python tests and syntax checks. The acoustic model is not trained, and trusted server-side audio alignment is still missing. No production tajweed accuracy is claimed. Until those components are implemented and independently validated, the app must describe acoustic tajweed analysis as not configured and must not issue model-generated tajweed rulings.
