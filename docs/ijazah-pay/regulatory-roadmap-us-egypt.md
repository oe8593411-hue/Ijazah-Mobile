# Ijazah Pay — Regulatory & Launch Roadmap (US + Egypt)

**Status:** Planning document only. Not legal advice, not a license application, and not approval to handle live funds.  
**Owner:** Ijazah Pay project team  
**Last reviewed:** 2026-10-18

## 1. Intended first product

The current business hypothesis is a payment service connected to the Ijazah education company and app, with a proposed EGP 10 fee per completed transfer. The team has mentioned an audience of about 10,000 students and a target of 5,000 users; these are planning assumptions, not verified transaction volumes.

The first regulated product under consideration is a payment institution that executes transfers using existing, authorized settlement systems. It is **not** initially intended to operate its own settlement rail.

Before implementation, define which of these is the real first use case:
- **A. Education checkout:** collecting Ijazah course/subscription payments for the education company.
- **B. Person-to-person transfers:** one user sends money to another user, including recipients outside Ijazah.
- **C. Both:** requires separate legal classification of each flow and may increase regulatory scope.

Do not treat A and B as legally equivalent. A hosted checkout through an authorized provider may have a different regulatory profile from operating a money-transfer service.

## 2. Officially confirmed regulatory starting points

### United States

- FinCEN states that businesses qualifying as money services businesses (MSBs) generally must register with the U.S. Treasury; money transmission is among the covered services. FinCEN registration is not itself a state money-transmitter license.
- State licensing, minimum net worth, surety bonds, permissible activities, examinations, and reporting depend on the states and exact business model. Do not assume a single state license authorizes nationwide operation.
- Before accepting live transfers, obtain a written U.S. regulatory analysis for the actual legal entity, ownership/control, fund flow, customer locations, and partner contracts. Identify each state where licensing or an exemption must be evaluated.

Official references:
- https://www.fincen.gov/resources/money-services-business-msb-registration
- https://www.csbs.org/csbs-money-transmission-modernization-act-mtma

### Egypt

- The Central Bank of Egypt (CBE) published licensing and registration rules for Payment System Operators (PSOs) and Payment Service Providers (PSPs) in June 2025. The CBE says the framework covers payment services and payment systems offered by institutions operating inside or outside Egypt to residents in Egypt, including payment transactions and money transfers.
- The CBE rules address prior approval, licensing documentation, minimum capital, financial guarantees, and supervision/inspection fees. The applicable category and exact thresholds must be checked against the official rule text and the intended service; this document does not assert a final capital figure.
- The CBE also published governance/internal-control requirements and suitability requirements for key officers. These should be included in the readiness assessment.
- Do not assume a U.S. company alone can provide the service to Egyptian residents without satisfying the applicable Egyptian requirements.

Official references:
- https://www.cbe.org.eg/en/payment-systems-and-services/payment-systems-and-services-oversight/psos-and-psps-licensing-rules
- https://www.cbe.org.eg/en/payment-systems-and-services/payment-systems-and-services-oversight/psos-and-psps-oversight-rules
- Central Bank and Banking System Law No. 194 of 2020.

## 3. Cost model — estimates versus confirmed requirements

No reliable all-in launch budget can be calculated until the activity, entity structure, U.S. states, transaction flow, and CBE category are known.

Create a separate estimate for each country and do not mix these cost types:

1. **Regulatory capital / minimum net worth:** funds that must remain available to meet regulatory requirements; not a software or marketing budget.
2. **Surety bond / financial guarantee:** may be a required guarantee; face value is not necessarily equal to the premium paid, and underwriting is not guaranteed.
3. **Application, examination, and supervision fees:** confirm with each regulator and the current fee schedule.
4. **Professional services:** U.S. state-by-state counsel, Egyptian regulatory counsel, compliance design, audit, tax, and corporate structuring.
5. **Operating readiness:** AML/CFT controls, sanctions screening, fraud monitoring, complaint handling, reconciliation, cybersecurity, incident response, independent testing, and trained staff.
6. **Partner and transaction costs:** bank/PSP onboarding, per-transfer fees, settlement, refunds, chargebacks, and reserves.

Any third-party capital figures are provisional until checked against current official rule text. Do not present estimates as confirmed regulatory amounts.

## 4. Immediate no-live-money work

Work can proceed now on software that does not receive, hold, transmit, or represent real customer funds:

- Product and fund-flow specification for A, B, or C above.
- Sandbox-only transfer simulator using clearly labeled test balances.
- Double-entry ledger prototype; immutable transaction/audit records; idempotency keys; explicit pending/succeeded/failed/reversed states.
- Fee calculator showing a proposed EGP 10 fee separately from the transfer amount, before confirmation.
- Reconciliation reports and duplicate/retry/failure tests.
- Threat model, access controls, key management plan, incident-response checklist, privacy/data-retention plan.
- API specification and partner-integration boundary; no real bank credentials or live transfer endpoints.
- Keep subscription checkout separate from person-to-person transfer functionality until each flow is legally classified.

**Hard stop:** no live transfers, customer-money custody, stored-value balances, or fee collection for money transmission until counsel confirms the required approvals/licences and the project has the relevant authorizations and partner arrangements. A sandbox success screen must never be described as a real transfer.

## 5. Decision gates

### Gate 1 — Product definition
Document payer, payee, purpose, countries of sender/recipient, who legally receives the funds, who controls funds, who charges the EGP 10 fee, and how a transfer is reversed/refunded.

### Gate 2 — U.S. legal analysis
Confirm the entity's state of formation and ownership; map customer states; determine FinCEN MSB status, state money-transmitter licensing/exemptions, bond/net-worth requirements, AML program, and partner-bank requirements.

### Gate 3 — Egypt legal analysis
Ask Egyptian payments counsel to map the intended activity to the CBE's PSP/PSO categories and confirm entity eligibility, prior approval, minimum capital, financial guarantee, key-person approvals, governance, reporting, and fee requirements directly from the current rules.

### Gate 4 — Written go/no-go
Build a country-by-country budget from written counsel/regulator/partner responses. If requirements cannot be met, keep the product in sandbox or limit it to an approved provider-hosted checkout model.

### Gate 5 — Controlled pilot
Only after approvals and contracts: limited pilot, transaction limits set by authorized partners and legal/compliance review, monitoring, reconciliation, customer support, incident drills, and independent security review.

## 6. Current assumptions and unresolved questions

- U.S. state of formation: unknown.
- Initial funding: unknown.
- Ijazah education-company legal entity, ownership, and country of incorporation: not yet verified.
- Initial flow: education checkout vs person-to-person transfers vs both — unresolved.
- Whether the EGP 10 fee is charged to sender, recipient, or education merchant — unresolved.
- Target states and whether transfers cross U.S./Egypt borders — unresolved.
- No licence, regulatory classification, bank sponsorship, or partner approval is assumed.

## 7. First concrete deliverables

1. One-page funds-flow diagram for each proposed use case.
2. U.S. state-by-state licensing questionnaire for counsel.
3. Egypt CBE category and capital/guarantee confirmation request.
4. Cost workbook separating confirmed amounts, quotes, and planning estimates.
5. Sandbox-only API/ledger prototype plan with security acceptance criteria.

This roadmap intentionally favors a narrow, reviewable pilot over launching a live money-transfer product before legal classification is confirmed.
