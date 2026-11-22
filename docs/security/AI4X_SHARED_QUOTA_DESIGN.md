# AI4X shared quota design (migration draft; not deployed)

## Status
Design only. No database credentials, schema, or production resources were changed. This document is not an active limiter.

## Proposed datastore
PostgreSQL (Neon or equivalent), with a single atomic transaction per request reservation. Avoid relying on server memory for global quotas.

### Tables (draft)
```sql
CREATE TABLE ai4x_quota_windows (
  subject_id text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  audio_bytes bigint NOT NULL DEFAULT 0 CHECK (audio_bytes >= 0),
  PRIMARY KEY (subject_id, window_start)
);
```

## Reservation contract
- Authenticate first; derive subject_id only from verified server-side identity.
- Reject anonymous requests while the feature is disabled.
- Reserve quota atomically using INSERT ... ON CONFLICT ... DO UPDATE guarded by limits.
- Use UTC fixed windows or a carefully implemented rolling window; document semantics.
- Enforce separate caps for requests, bytes, concurrent jobs, and provider-cost units.
- Fail closed (503) if the quota store cannot safely reserve.
- Refund/reconcile reservation only for failures proven to occur before provider work; never allow client retries to reset usage.
- Use an idempotency key bound to subject, route and payload digest to prevent duplicate charges/work.
- Keep retention short; store hashed subject IDs if operationally appropriate, and do not store audio.

## Authentication integration blockers
The repository currently does not show an established server-side auth verifier in this endpoint. Do not accept user IDs, JWTs, or tokens merely from client JSON/headers without cryptographic verification and issuer/audience/expiry checks. Choose a provider and verify its SDK/server API before coding.

## Suggested initial policy (tunable)
- 3 analysis requests / 15 minutes per authenticated user
- 20 MiB max request payload (existing limit)
- 10-ayah maximum per request (existing new guard)
- 1 concurrent analysis per user
- Explicit daily provider-cost budget and circuit breaker
These are proposal values, not active enforcement.

## Deployment gates
1. Provider authentication implementation and tests.
2. Atomic reservation test with concurrent requests.
3. Store outage fail-closed test.
4. Duplicate idempotency request test.
5. Multi-instance integration test.
6. Privacy-safe logs, alerts and spending controls.
7. Security review before setting `IJAZAH_ANALYSIS_ENABLED=true`.
