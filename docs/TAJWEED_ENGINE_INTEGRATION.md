# Real Acoustic Tajweed Engine Integration

## Selected engine

Initial candidate: [Quran Muaalem](https://github.com/obadx/quran-muaalem), using the published `obadx/muaalem-model-v3_2` model and `quran-transcript` reference phonemizer. The model predicts phonemes and articulatory attributes from audio against a supplied Quranic phonetic reference. It is a candidate engine, not a claim of production validation.

## Why this is not a Vercel function

The model uses PyTorch/Wav2Vec2-BERT and expects 16 kHz mono audio. Its published engine is a persistent Python service; Vercel's current Expo web deployment should not load the model inside a serverless function. Run the model service on a separate GPU-capable host and keep the service credential server-side.

## Current app contract

The app endpoint `api/analyze-recitation.ts` calls the service configured by:
- `IJAZAH_TAJWEED_ENGINE_URL`
- `IJAZAH_TAJWEED_ENGINE_TOKEN`

The current contract sends multipart fields `file`, `surah`, `ayah`, `riwaya`, `referenceText`, `expectedRuleChecks`, and `responseContract`. The service must return JSON with `rulesEvaluated` and `findings`. Each finding must contain `ruleId`, `wordIndex`, `confidence`, and specific `evidence`; optional timing fields are `startMs` and `endMs`.

**Important:** the upstream Quran Muaalem API has its own schema. It is not a drop-in match for this app contract. A server-side adapter must translate its actual phoneme/sifat output into app findings; it must not turn a generic model output into a tajweed error without comparing the predicted attribute against the verified Hafs reference at the correct phoneme location.

## Release gates

1. Host the model and a versioned adapter; keep the API private with a strong server-side token.
2. Convert uploads to mono 16 kHz audio and enforce duration, byte-size, and concurrency limits.
3. Verify the exact Hafs phonetic reference using `quran-transcript`; do not generate Quran text with an LLM.
4. Reject output when phoneme alignment is uncertain or the recognized content does not match the requested ayah.
5. Return only findings tied to an expected rule candidate and a mapped phoneme location. Include calibrated confidence and acoustic evidence.
6. Test clean recitations and deliberately annotated errors across multiple voices, devices, and recording conditions; have qualified tajweed teachers review the results.
7. Only after validation, configure `IJAZAH_TAJWEED_ENGINE_URL` and `IJAZAH_TAJWEED_ENGINE_TOKEN` in the hosting provider's server-side environment. Keep `IJAZAH_ANALYSIS_ENABLED` disabled until authentication and shared rate limiting are in place.

## Status

This document records the selected integration path. It does not mean the model has been hosted, configured, or validated. Until those steps are complete, the app must not claim that acoustic tajweed analysis is active.
