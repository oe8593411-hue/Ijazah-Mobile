# AI4X adversarial test plan

This plan is intentionally a test specification, not evidence that tests have run.

## Request gate
- Disabled flag: returns 503 without reading body or calling provider.
- Non-POST: returns 405.
- Missing provider key: returns 503.
- Unsupported riwayah: returns 409 and makes no provider calls.
- Invalid surah/scope/ayah values: returns 400/404 and makes no provider calls.
- More than 10 ayahs in continuous or full-surah scope: returns 422 before audio-body read/provider calls.

## Request body and resource limits
- Body below minimum: returns 400.
- Body over 20 MiB: returns 413 and does not call transcription.
- Request body stream interrupted: controlled error, no provider calls.
- Repeated requests across multiple serverless instances: current local limiter is NOT expected to enforce a global quota; this test highlights the remaining gap.

## Audio decoding (engine)
- Invalid containers, malformed headers and truncated payloads.
- Metadata claims duration/frame counts outside bounds.
- Sample rates above 192 kHz; channels above 8.
- Decoder output with non-finite samples, silence, or oversized output.
- FFmpeg probe/decode timeout, missing binaries, nonzero exit, and oversized output.

## Consensus and result safety
- Primary/verifier disagreement: no word-level red/error findings.
- Low confidence: no definitive errors.
- Mismatch locations must map to validated reference word locations.
- Engine findings must match expected ruleId and wordIndex, confidence >= 0.8, evidence present and valid timing.
- Malformed engine response: findings discarded.

## Deployment prerequisites before enabling
- Real authentication verified server-side, not merely client-side.
- Shared atomic rate limiter and per-user quota, fail-closed if store unavailable.
- Per-user concurrency and spending limits.
- Hosting proxy/IP trust configuration verified.
- Request-size enforcement at the hosting edge.
- Logs avoid secrets and raw audio/transcript unless an explicit privacy-safe policy permits.
- CI tests and independent security review completed.
