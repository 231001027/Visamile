# Visamile — multi-role visa platform (MVP)

Core flow with **four logins** (embassy has none):

1. **Consumer (traveler)** — self-apply, upload docs, pay, track  
2. **Partner (agency)** — apply for clients, wallet / online pay (existing B2B)  
3. **Processor (verifier)** — check docs, mark sent to embassy, record approve/reject  
4. **Admin (platform)** — catalog, partners, processors, final delivery, maintenance fees  

Fee split per case: government fee + **platform fee** (us) + **processor fee** (service).

See `docs/ARCHITECTURE_MAPPING.md` for the earlier B2B screenshot-driven rebuild.

## What's real vs. stubbed, up front

**Modeled closely on the reference platform:**
- Payment is pay-after-creation, not pay-at-creation — cases sit in a
  **Pending Payment** queue and get batch-paid, either from wallet balance
  or a direct one-time online charge (the hybrid model — see below).
- Partner profile: agent code, assigned sales person, GST/PAN/TAN with
  document-approval status, MSME flag, per-country indemnity acceptance,
  bank details, multi-branch support.
- Visa catalog: each package carries its own entry type, visa category,
  validity/duration/processing time, and separate adult/child rates. Bulk
  Apply lists bulk-only catalog rows grouped by traveler category.

**Still stubbed** — payment gateway is a dev-mode simulation (no real PayU
credentials wired up), embassy/VFS submission is a manual ops action, and
notifications just log to the console. See §"What's stubbed" below.

## The payment model (read this before touching `src/lib/ledger.ts`)

1. Apply Visa / Bulk Apply create a case directly in `PENDING_PAYMENT` —
   **no wallet debit happens at creation.**
2. The agent goes to **Pending Payment**, selects one or more cases, and
   picks one of two pay modes:
   - **Pay from wallet** — debits existing wallet balance
     (`POST /api/wallet/pay-cases`), blocked if the balance is short.
   - **Pay online now** — a direct one-time PayU charge for exactly that
     batch, no pre-funded wallet required
     (`POST /api/payments/pay-cases-online`).
3. Either way, on success every paid case gets the same shape of ledger
   entry (one `DEBIT` `WalletTransaction` per case, tagged with a shared
   `batchId`) — see `src/lib/ledger.ts` `applyPaymentOrder`, which
   deliberately credits-then-immediately-spends the direct-pay amount so
   reporting never needs to special-case "how was this paid for."
4. A separate **Wallet Recharge** flow (`POST /api/wallet`) tops up the
   wallet for later use, independent of any specific case.

Cancelling a case that was already paid for (`PAID` or later) automatically
refunds it — see `refundCase` in the same file.

## Prerequisites

- Node.js 20+
- Docker (for local Postgres) — or point `DATABASE_URL` at any Postgres 14+ instance
- Normal internet access when you run `npm install` / `npx prisma generate` —
  Prisma's CLI downloads a small schema-engine binary on first use. (This
  scaffold uses Prisma's driver-adapters mode — `@prisma/adapter-pg` — so no
  engine binary is needed at *runtime*, only the CLI's one-time setup step
  needs it.)

## How this was verified before shipping

The environment used to write this code can't reach `binaries.prisma.sh`
(network egress allowlist), so `npx prisma generate` couldn't be run there.
A temporary type shim stood in for the generated Prisma types just long
enough to run `tsc --noEmit` and `next build`'s compile + type-check phases
across the whole project — **zero errors** on both, on every pass through
this rebuild. The build only stops afterward at the expected "Prisma client
not generated" step, which running `npx prisma generate` (below) resolves.

## Setup

```bash
cp .env.example .env
# Open .env and set AUTH_SECRET to a long random string, e.g.:
#   openssl rand -base64 48

docker compose up -d          # starts local Postgres on :5432
npm install
npx prisma migrate dev --name init
npx prisma db seed            # demo catalog, accounts, and pricing

npm run dev                   # http://localhost:3000
```

## Demo logins (created by the seed script)

| Role | Email | Password | Portal |
|------|-------|----------|--------|
| Admin (platform) | ops@visamile.test | Passw0rd! | `/admin` |
| Partner (agency) | agent@vacationer.test | Passw0rd! | `/partner` (wallet ₹100,000) |
| Consumer (traveler) | traveler@visamile.test | Passw0rd! | `/consumer` |
| Processor (verifier) | verifier@visamile.test | Passw0rd! | `/processor` |

To see the approval flow itself, register a **new** partner account at
`/register` — it lands in `Pending` on the admin's Partners page with no
agent code until approved.

## Suggested walkthrough

1. Log in as the partner → **New case** → pick a destination → pick a
   package from the rate table → fill in applicant details → save. It's now
   sitting in **Pending payment**, not yet charged.
2. Try **Bulk apply** → pick Austria → pick a traveler category (e.g.
   "Child below 6 yrs") → add a couple of rows → create. Several cases land
   in Pending Payment at once.
3. Go to **Pending payment**, select some cases, and try both pay modes:
   "Pay from wallet" (instant, uses the seeded balance) and "Pay online now"
   (redirects to the dev checkout simulation, then completes automatically).
4. Upload a document on a case detail page and watch the status history.
5. Log in as admin (different browser/incognito, since sessions are
   cookie-based) → **Case queue** (only shows `PAID` and later — Pending
   Payment cases aren't ops's problem yet) → open a case → advance it
   through Submitted → Approved → Delivered.
6. Try cancelling a `PAID` case as admin and check the partner's wallet —
   the refund posts automatically.
7. Visit **Profile** as the partner and look at the GST/bank/branches/
   indemnity sections — upload a file for the GST certificate field.
8. On admin's **Partners** page, approve a newly-registered partner and
   watch it get assigned an agent code.

## Project structure

```
prisma/schema.prisma          Data model — see the file's own comments for
                               the reasoning behind the payment-order and
                               case-status design
prisma/seed.ts                 Demo catalog, accounts, and pricing

src/lib/
  caseCreation.ts               Shared case-creation logic (single + bulk)
  ledger.ts                     Wallet ledger: append-only, batch case
                                 payment, direct-pay application, refunds
  caseStateMachine.ts            Explicit allowed-transitions map
  payment.ts                     PayU adapter (real + dev stub)
  paymentFees.ts                 Gateway fee schedule (UPI/Netbanking/Card)
  agentCode.ts                   Human-readable agent code generator
  session.ts / password.ts        Auth (JWT via `jose`, bcrypt)
  storage.ts                      Document storage behind an S3-shaped interface

src/app/api/                  Route handlers — auth, cases (+ bulk), documents,
                               wallet, payments, profile, partners, indemnity, pricing
src/app/partner/               Partner portal — dashboard, new case, bulk
                               apply, pending payment, wallet, profile
src/app/admin/                  Ops console — case queue, case review,
                               partner approval
src/middleware.ts               Route guard for /partner/* and /admin/*
```

## What's stubbed

- **Payment gateway**: `src/lib/payment.ts` has a real `PayUGateway` (hash
  signing per PayU's spec) but it's inactive until you set
  `PAYMENT_GATEWAY_KEY` / `PAYMENT_GATEWAY_SECRET` in `.env`. Without those,
  a `DevInstantGateway` simulates checkout via
  `/partner/wallet/dev-checkout` — clearly labeled as dev-only in the UI,
  and it refuses to run once real credentials are configured.
- **Embassy/VFS submission**: "Mark submitted" is an ops action recording
  that a human submitted the case elsewhere — no embassy API integration.
- **Notifications**: logged to console + a DB row.
- **Document malware scanning**, **MFA**, **field-level passport encryption**:
  not implemented — flagged inline in the relevant files.

## Known MVP simplifications

- `src/lib/reference.ts` and `src/lib/agentCode.ts` generate IDs by counting
  existing rows, which isn't perfectly race-safe under very high concurrent
  volume. Replace with a DB sequence before relying on this at scale.
- Bulk Apply rows only capture name + passport number; the rest of a case's
  passport/applicant fields are added afterward from the case detail page.
- No automated tests yet.
