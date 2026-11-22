# Security hardening changes (branch review)

Branch: `security/ai4x-api-audit`

## Implemented
- API IP limiter no longer trusts client-supplied `X-Forwarded-For` or `X-Real-IP`. It uses the socket address only; if unavailable, the limiter rejects.
- The instance-local IP map has an explicit key cap and prunes expired keys, then rejects rather than continuing to grow.
- Audio decode path inspects metadata before allocating decoded PCM: duration/frame count, sample rate and channel count are bounded; checks decoded array shape against inspected metadata.

## Important residual risks
- Instance-local IP throttling is not distributed: it can be bypassed across serverless instances and may not identify client IP behind hosting proxies. This is explicitly defense-in-depth only.
- Shared store, authenticated per-user quotas, abuse monitoring and concurrency/cost budgets remain prerequisites to enable public analysis. The feature remains disabled by default.
- FFmpeg probing/decoding is time-limited and output duration-bounded, but host/container resource limits and upstream request-size enforcement still need deployment verification.
- No penetration test was performed; no test suite was executed in this change session.

## Commits
- `a0116d6`: Stop trusting spoofable forwarded IP headers.
- `d5e7222`: Bound audio metadata before PCM decoding.
