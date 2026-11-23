# Ijazah Pay — Secure Payment Foundation

Ijazah Pay is the branded subscription and payment experience for the Ijazah app and website.

## Scope for the first release

- Branded checkout and subscription-management experience.
- Plans, prices, currency, billing status, renewal/cancellation state, and receipts.
- Server-authoritative entitlement checks: the app must never unlock Premium based only on a client-side success screen.
- Payment-provider integration through a licensed provider; provider is intentionally not selected yet.
- Provider webhook verification, idempotent event handling, audit trail, and safe retries.
- A sandbox/test mode before any live payments.

## Security requirements

1. Never collect or store raw card numbers, CVV, bank passwords, or payment PINs in Ijazah systems.
2. Use provider-hosted checkout or provider tokenized payment components.
3. Keep provider secret keys only in server-side environment variables; never in the mobile app or public repository.
4. Verify webhook signatures and event timestamps using the provider's official SDK/documentation.
5. Make webhook processing idempotent and persist provider event IDs to prevent duplicate subscription changes.
6. Grant or revoke Premium only from verified server-side payment state.
7. Validate amount, currency, product/plan, and merchant account on the server; never trust amounts sent by the app.
8. Log security-relevant events without logging payment credentials or sensitive card data.
9. Separate sandbox and production credentials and endpoints.
10. Do not claim a payment succeeded until the provider confirms it server-side.

## Architecture

- **Mobile app:** displays plans and launches the approved checkout flow; it does not hold payment secrets.
- **Backend API:** creates checkout sessions, validates account ownership, handles verified webhooks, and manages entitlements.
- **Database:** stores plans, checkout references, subscription state, webhook event IDs, and an audit trail. Store provider references, not card details.
- **Payment provider:** licensed provider responsible for regulated payment processing and settlement.

## Launch blockers / decisions

- Confirm the legal merchant/entity and its country of registration.
- Select a provider that onboards that entity and supports the required countries and currencies.
- Confirm whether the product is a digital subscription sold inside Google Play / Apple App Store. Store billing rules may require in-app billing for some purchases; an external checkout must not be added until the applicable rules are checked.
- Obtain the provider's merchant onboarding approval and production credentials.
- Complete sandbox tests for success, failure, cancellation, duplicate webhook, delayed webhook, refund, and chargeback cases.
- Obtain legal/accounting review for Egyptian tax, invoicing, consumer disclosures, and any Central Bank of Egypt requirements applicable to the actual business model.

## Important limitation

This document is the safe foundation, not a live payment gateway. No money can be charged until a provider is selected, the merchant is approved, credentials are configured securely, and server-side payment verification is implemented and tested. Ijazah Pay will own the branded experience and subscription logic, not independently process card networks or hold customer funds.
