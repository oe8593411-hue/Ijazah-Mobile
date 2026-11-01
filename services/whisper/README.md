# Whisper transcription for recitation evaluation

`transcribe.py` runs an open Whisper model locally on one audio clip and prints the
words it hears, with timestamps and probabilities, as JSON. The harness in
`scripts/recitation-eval/` scores those words against the verified Quran text.

This is not a public service. It has no login, no rate limit and no server. Under
`docs/RECITATION_ENGINE.md`, an endpoint must not be exposed to users until
authentication, per-user rate limits and tests exist.

## Run

    python3 -m pip install -r services/whisper/requirements.txt
    WHISPER_MODEL=large-v3 python3 services/whisper/transcribe.py recitation-data/clips/example.wav

The first run downloads the model weights from Hugging Face.

Environment variables:

- `WHISPER_MODEL`: model name or local path (default `large-v3`).
- `WHISPER_DEVICE`: `cpu`, `cuda` or `auto` (default `auto`).
- `WHISPER_COMPUTE_TYPE`: for example `int8` on CPU or `float16` on GPU (default `default`).

## Evaluate

    node scripts/recitation-eval/evaluate.mjs \
      --manifest recitation-data/manifest.json \
      --engine-cmd "python3 services/whisper/transcribe.py" \
      --label whisper-large-v3

Copy `scripts/recitation-eval/manifest.example.json` to `recitation-data/manifest.json`
and fill it in. Every clip needs a consent record and consent for commercial use,
training and evaluation. Otherwise the run stops before the engine is called.

## Built-in rules

- The expected verse is never sent to the model. A prompt containing the expected text
  makes Whisper write the verse back and hides the mistakes the app has to catch.
- The voice activity filter is off by default, so soft recitation is not cut.

## Before any commercial release

- Check the licence of the exact weights you run. Hugging Face copies can carry different
  metadata from the original release.
- Tarteel's models (`tarteel-ai/whisper-*-ar-quran`) are for comparison only until their
  training data and its licence are confirmed.
- Clips and consent records live in `recitation-data/`, which git ignores.
- Raw user audio must be deleted after processing unless the user opts in. This rule
  applies to any future server path.

## Tests

    cd services/whisper && python3 -m unittest -v test_transcribe

The tests use a fake model, so they run without the Whisper weights or the GPU stack.
