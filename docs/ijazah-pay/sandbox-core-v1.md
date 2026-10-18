# Ijazah Pay Sandbox Core v1 — Technical Specification

**Status:** Design only; no real money, banking credentials, or live payment rails.  
**Companion:** [Regulatory roadmap](./regulatory-roadmap-us-egypt.md)

## Product boundary

This prototype models transfer requests and fees with test-only funds. It must not imply that simulated funds are redeemable or that any bank transfer occurred. Live execution remains disabled until the legal and partner approval gate is satisfied.

## Transaction lifecycle

Allowed states:
- `created`
- `awaiting_authorization`
- `processing`
- `succeeded`
- `failed`
- `reversed`
- `cancelled`

State transitions must be explicit and validated server-side. A succeeded transaction cannot be edited in place; corrections use a linked reversal/adjustment record. Retried requests with the same idempotency key return the original result and do not create another transfer or fee.

## Proposed test-only data model

### transfer_intents
- `id` — random UUID, primary key
- `environment` — must be `sandbox` for v1
- `client_reference` — caller-provided reference, unique per client
- `sender_ref`, `recipient_ref` — pseudonymous test identities
- `amount_minor` — integer in the currency's minor units; positive
- `currency` — explicit ISO currency code
- `fee_minor` — explicit fee in minor units; for the proposed EGP 10 fee, store 1000 piastres only when currency is EGP and the fee policy is confirmed
- `status` — lifecycle state
- `idempotency_key` — unique per API client
- `created_at`, `updated_at` — server timestamps
- `metadata` — allowlisted non-sensitive JSON only

### ledger_entries
- `id` — UUID
- `transaction_id` — links to transfer intent
- `account_code` — sandbox ledger account identifier
- `currency`
- `debit_minor`, `credit_minor` — non-negative integers; exactly one side positive per row
- `created_at`

Ledger entries are append-only. For each posted transaction, total debits must equal total credits per currency. Never change balances with direct updates; derive balances from ledger entries or use a carefully maintained, reconciled projection.

### audit_events
- `id`, `actor_type`, `actor_ref`, `action`, `object_type`, `object_ref`, `request_id`, `occurred_at`, `result`
- Exclude passwords, secrets, full bank details, payment PINs, and unnecessary personal data.

### api_clients
- `id`, `name`, `environment`, `key_hash`, `scopes`, `status`, `created_at`
- Display a secret only once at creation; store a secure hash where feasible; support rotation and revocation.

## Fee calculation

For an EGP-denominated sandbox transfer, display the transfer amount, the proposed EGP 10 fee, and total debit separately before confirmation. Never silently add the fee. The fee is a product assumption, not a regulator-approved tariff, and must be reviewed for consumer disclosures, tax treatment, partner contracts, and legal permissibility before live use.

## API sketch (sandbox only)

- `POST /v1/sandbox/transfers` — create a test transfer; requires authenticated API client and idempotency key.
- `GET /v1/sandbox/transfers/{id}` — retrieve status for an authorized client.
- `POST /v1/sandbox/transfers/{id}/cancel` — allowed only before final posting.
- `POST /v1/sandbox/transfers/{id}/simulate-result` — internal test-only endpoint, unavailable in production builds and never exposed to public clients.
- `GET /v1/sandbox/ledger/reconciliation` — authorized test reports.

No live `/transfers` endpoint should exist in v1.

## Security and reliability acceptance criteria

1. All endpoints require authentication, authorization, input validation, and rate limiting.
2. Idempotency is enforced atomically at the database layer.
3. Currency and amounts are validated; no floating-point arithmetic for money.
4. Ledger postings balance and are append-only.
5. Client cannot choose or force a successful result.
6. Logs are structured and redact sensitive data.
7. Secrets never enter the mobile bundle, source control, or logs.
8. Webhook signatures, timestamps, replay protection, and idempotent processing are mandatory before any provider webhooks are enabled.
9. Tests cover duplicate requests, concurrent retries, timeouts, partial failures, reversal, unauthorized access, and currency mismatch.
10. Production configuration must fail closed if a sandbox flag is missing or any live-money feature is accidentally enabled.

## Not in v1

- Custody of real funds or customer balances
- Live bank transfer execution
- Cash-in/cash-out
- Card data storage
- Cross-border remittance
- Lending, yield, or stored-value wallet
- Public partner onboarding
- Claims of regulatory approval or guaranteed transfer success

## Go-live gate

No live-money feature may be enabled until a written legal classification and licensing plan exists for each target country, all required approvals are obtained, financial institution/provider contracts are executed, security review is passed, and customer disclosures/complaint/refund processes are approved.
