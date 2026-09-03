# Architecture mapping

This scaffold went through two passes: an initial build against the general
solution-architecture doc, then a rebuild against real screenshots of the
reference B2B visa platform. This doc covers both.

## Pass 2: what the screenshots corrected

| Area | What the screenshots showed | What changed here |
|---|---|---|
| Payment timing | Cases sit in a **Pending Payment** queue, unpaid, until the agent batch-pays them | `CaseStatus` gained `PENDING_PAYMENT` → `PAID` as explicit steps before `SUBMITTED`. Case creation no longer touches the wallet at all (`src/lib/caseCreation.ts`). |
| Payment mode | The Pending Payment screen's "Paymode" field is a dropdown (seen set to WALLET) | Interpreted as a hint that more than one mode is supported — built as a genuine hybrid: `POST /api/wallet/pay-cases` (from wallet) and `POST /api/payments/pay-cases-online` (direct charge, no pre-funded wallet needed). Both produce identical ledger shapes via `applyPaymentOrder`. |
| Payment gateway | PayU checkout, with a visible "Internet Handling Fee" + 18% GST added on top, varying by method (₹2/0.02% UPI vs ₹19/0.19% Net Banking on a ₹10,000 top-up) | `src/lib/paymentFees.ts` calibrated to those exact figures; `src/lib/payment.ts` has a real PayU hash-signing implementation plus a dev stub. |
| Agent profile | Agent code, sales person, finance person, invoice frequency, GST/PAN/TAN with document approval status, MSME, bank details, multi-branch, per-country indemnity, wallet T&C acceptance | All added to `Partner` + new `PartnerBranch` / `PartnerIndemnityAcceptance` models; full profile page at `/partner/profile`. |
| Visa catalog | Each package has its own entry type, visa category, validity/duration/processing time, and separate adult/child rates; Bulk Apply lists bulk-only rows grouped by traveler category | `VisaType` restructured with those fields + `isBulkEligible`/`bulkCategoryLabel`; pricing moved to a versioned `VisaTypeRate` (adult + child pair) replacing the original partner-tier-only model. |
| Application data | Structured passport fields (issue/expiry dates, parents' names, place of birth, etc.) captured directly on the form, not just inside an uploaded file | Added directly to `Case` rather than left inside `Document`. |
| Document categories | ~16 fixed upload categories (employment-profile-specific, travel history, invitation docs, etc.), not a dynamic per-visa-type checklist | `DocumentType` enum expanded to match; the existing generic uploader component just got a longer dropdown rather than needing a new UI. |

## Pass 1: original doc vs. what got built

| Doc section | What it called for | Status |
|---|---|---|
| 3.2 API gateway & auth | JWT/OAuth2, rate limiting, partner API keys, MFA | JWT session auth ✅. **Not built**: rate limiting, a separate partner API-key channel, MFA. |
| 3.3 Case management | Explicit state machine + audit trail | ✅ `src/lib/caseStateMachine.ts` + `CaseStatusEvent`, now with the corrected pay-after-creation states. |
| 3.3 Payments & wallet | Append-only ledger, commission engine | ✅ Ledger is append-only with retry-on-conflict; commission is captured per case (`commissionSnapshot`) but there's no payout batch job yet. |
| 3.3 Document vault | Upload, virus scanning, checklist logic | Upload + checklist data model ✅. **Not built**: virus/malware scanning, auto-expiry job. |
| 3.4 Data layer | Postgres system of record, S3 for documents, Redis for cache/queue | Postgres ✅ (via Prisma driver adapters — no native engine binary needed at runtime). Storage is behind an S3-shaped interface, backed by local disk (`src/lib/storage.ts`) — swap the implementation, not the callers, for production. **No Redis/queue yet.** |
| 8. Data security | Encryption, RBAC, audit logging, retention, consent | Partial: RBAC via role checks everywhere, audit trail via `CaseStatusEvent`, bcrypt password hashing, `httpOnly`/`sameSite` cookies. **Not built**: field-level passport-number encryption, retention/deletion jobs, WAF/VAPT (infra-level), CERT-In runbook (organizational). |

## Suggested next engineering priorities, in order

1. Wire real PayU credentials in a test/sandbox account and exercise the
   real webhook path end to end (`/api/payments/callback`) — the hash
   signing is implemented but untested against a live PayU response.
2. Malware scanning on the document upload path before any real passport
   data flows through it.
3. Move notification dispatch off the request path onto a queue.
4. Field-level encryption for `applicantPassportNo`.
5. Partner API keys + a documented bulk/API submission endpoint (the doc's
   own differentiator vs. portal-only competitors) — the bulk creation
   logic in `src/lib/caseCreation.ts` is already factored to support this.
6. A proper editing UI for a case's passport/applicant fields after
   creation — Bulk Apply currently creates minimal rows (name + passport
   number only) that need those fields filled in afterward, and there's no
   dedicated edit form yet, only the document uploader.
