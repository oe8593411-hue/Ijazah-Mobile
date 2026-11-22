# Security hardening changes (branch review)

Branch: `security/ai4x-api-audit`

## Implemented
- API IP limiter no longer trusts client-supplied `X-Forwarded-For` or `X-Real-IP`. It uses the socket address only; if unavailable, the limiter rejects.
- The instance-local IP map has an explicit key cap and prunes expired keys, then rejects rather than continuing to grow.
- Audio decode path inspects metadata before allocating decoded PCM: duration/frame count, sample rate and channel count are bounded; checks decoded array shape against inspected metadata.
- Multi-ayah/surah analysis requests over 10 ayahs are rejected before audio is read or transcription providers are called, limiting large-range cost and alignment work.

## Important residual risks
- Instance-local IP throttling is not distributed: it can be bypassed across serverless instances and may not identify client IP behind hosting proxies. This is explicitly defense-in-depth only.
- Shared store, authenticated per-user quotas, abuse monitoring and concurrency/cost budgets remain prerequisites to enable public analysis. The feature remains disabled by default.
- FFmpeg probing/decoding is time-limited and output duration-bounded, but host/container resource limits and upstream request-size enforcement still need deployment verification.
- No penetration test was performed; no test suite was executed in this change session.

## Commits
- `a0116d6`: Stop trusting spoofable forwarded IP headers.
- `d5e7222`: Bound audio metadata before PCM decoding.


## Endpoint security lock (latest)
- Added an unconditional fail-closed 503 security lock at the top of the analysis handler. The lock is not controlled by an environment variable and prevents transcription/provider spend while verified server authentication and shared quotas remain absent.
- The previous handler body remains below this lock as inactive code and must not be reactivated until authentication, atomic shared quotas, concurrent tests, and independent review are completed.
- Commit: `a126e2e`.
