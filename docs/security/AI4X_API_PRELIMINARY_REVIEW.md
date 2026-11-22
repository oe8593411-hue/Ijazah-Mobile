# AI4X API Security Review (preliminary)

Reviewed commit: 4756ed9de81ca67f4826405aed163fdeacc217dc (PR #17 head)
Scope: API request flow, token guard in acoustic engine, upload handling, and CI workflow excerpts. This is a code review note, not a full penetration test.

## Findings

### High priority before enabling public analysis
- **Authentication and per-user rate limiting are prerequisites, not optional.** The app API explicitly returns 503 unless `IJAZAH_ANALYSIS_ENABLED=true`; preserve this fail-closed behavior until authentication and server-side per-user quotas are implemented.
- **The existing in-memory/IP limiter is not a robust abuse-control boundary.** Serverless instances do not share state; IP-based limits can be bypassed across instances and may depend on proxy-header trust. Do not rely on forwarded headers unless the hosting proxy sanitizes them. Replace with a shared store and authenticated user quotas, plus concurrency/cost limits.
- **Request body and audio decoding limits need infrastructure-level enforcement too.** The handler caps raw bytes at 20 MB, but verify provider/hosting request limits, decoded duration/sample count, memory and CPU limits, and multipart/parser behavior before enabling the service.
- **Protect upstream provider spend.** Authentication, quotas, abuse monitoring, request concurrency limits, and a hard budget/kill switch must be in place before turning the API on.

### Reviewed positive controls
- API analysis is disabled unless explicitly enabled.
- Upload size guard (20 MB) is visible in the API handler.
- Specialized engine rejects requests when its token is unset and uses constant-time token comparison.
- Audio/reference candidate alignment uses server-side aligner evidence; client timestamps are ignored.
- Low-confidence alignment is rejected before candidate scoring.
- CI workflows specify read-only `contents: read` permissions.
- Web validation checkout disables persisted credentials.

### Further review required
- Full endpoint review: CORS, headers, request parsing, query/body validation, audio decoding and timeouts.
- Verify `IJAZAH_TAJWEED_ENGINE_URL` is restricted to trusted deployment configuration and cannot be influenced by client input (SSRF).
- Review token rotation/storage, model-file provenance, dependency vulnerabilities, workflow action pinning, secret exposure and branch protections.
- Perform adversarial tests and independent review before production enablement.

## Status
No production configuration changed. No secrets, thresholds, model weights, Quran corpus, or deployment settings changed. Public analysis should remain disabled pending remediation and verification.
