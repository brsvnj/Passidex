# Passidex

**EU-wide Digital Product Passport (DPP) compliance platform for SMEs.**

Passidex covers **ESPR** (Ecodesign for Sustainable Products Regulation) **and CPR**
(Construction Products Regulation) requirements in a single tool, so small and
medium businesses don't need separate per-industry enterprise solutions.

The core differentiator is **AI-assisted data collection from suppliers** — the
biggest cost of DPP compliance for SMEs isn't the software, it's the manual work
of gathering data from the supply chain.

## Monorepo layout

```
passidex/
├─ apps/
│  ├─ web/          # React + Vite + Tailwind frontend (Passidex)
│  └─ api/          # NestJS + Prisma + PostgreSQL backend
├─ packages/
│  └─ schema/       # Shared category/field definitions (ESPR/CPR) + EU DPP mapping
```

The **`@passidex/schema`** package is the single source of truth for what data
each product category requires. Both the frontend and backend import it, so the
UI, the "missing fields" logic, and the DPP export all stay in sync.

## Data model (Phase 1)

Every schema field of a product carries a **status** and full **history**:

```
MISSING → REQUESTED → RECEIVED_PENDING → CONFIRMED
                          │ (low confidence → needsReview)
                          └─ reject → back to REQUESTED / MISSING
```

- A product has one or more **components** (BOM); each may map to a **supplier**
  that contributes part of the passport data.
- Every field-value transition is recorded in an append-only **FieldEvent**
  audit log (who, when, source) — a DPP must stay current across the whole
  product lifecycle.
- Field definitions carry a **`dppPath`** so the passport can be projected into
  GS1 Digital Link / EU DPP Registry format without a data migration.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | Monorepo scaffold, Passidex branding, MVP frontend migration | ✅ |
| 1 | Data model + Prisma migrations + CRUD + field state machine | ✅ |
| 2 | Supplier request generation + email + reminders | ✅ |
| 3 | Inbound email + document ingestion + AI extraction | ✅ |
| 4 | Admin dashboard (completeness, bottlenecks) + manual entry | ✅ |
| 5 | GS1 Digital Link / EU DPP Registry export | ✅ |

### Phase 2 — supplier requests & reminders

- Passidex detects the **MISSING** fields a supplier should provide (schema
  `suppliedBy: "supplier"`) and bundles them into a **DataRequest**.
- It generates a **localized email** (sl / en / de, chosen from the supplier's
  language) with a unique per-request reply-to address, and moves those fields
  to **REQUESTED**.
- Without `POSTMARK_SERVER_TOKEN`, emails are logged to the console so the full
  lifecycle is testable in dev; suppliers with no email address create a request
  that stays `DRAFT` for manual entry.
- A **pg-boss** cron sweep resends reminders after `REMINDER_AFTER_DAYS` of no
  answer, up to `MAX_REMINDERS`. `POST /api/data-requests/run-reminders` runs the
  sweep on demand.

Key endpoints: `POST /api/data-requests`, `GET /api/data-requests`,
`POST /api/data-requests/:id/cancel`, `POST /api/data-requests/run-reminders`.

### Phase 3 — inbound email & AI extraction

- Suppliers reply to the request's unique reply-to address. Postmark delivers the
  email to `POST /api/inbound/postmark?token=…`, which matches it to the
  `DataRequest`, stores the message and attachments (S3, or local disk in dev),
  and marks the request **ANSWERED**.
- A pg-boss `parse.message` job (or inline when the queue is disabled) sends the
  email text + attachments to **Claude** via forced tool use. Claude reads PDFs
  and images natively and returns structured `{ fieldKey, value, confidence }`.
- Each mapped value is **proposed** into `RECEIVED_PENDING` — never auto-confirmed.
  Low-confidence or ambiguous values are flagged `needsReview`. Already-confirmed
  fields are never overwritten. The full extraction is stored (`Extraction` /
  `ExtractedField`) for audit.
- The dashboard's **"Čaka potrditev"** queue lets a user confirm / correct /
  reject each proposal.

Configure Postmark to POST inbound mail to `…/api/inbound/postmark?token=$INBOUND_WEBHOOK_SECRET`.

### Phase 4 — supply-chain analytics

`GET /api/dashboard/analytics` returns where compliance is stuck: field-status
distribution, request-status counts, **per-supplier** open / overdue / answered
counts and **average response time**, and the oldest open requests. The dashboard
renders this as a collapsible "Analitika oskrbovalne verige" panel.

### Phase 5 — GS1 Digital Link / EU DPP export

`GET /api/products/:id/passport` projects a product's **confirmed** field values
into a DPP document keyed by each field's `dppPath`, together with a **GS1 Digital
Link** (`https://{resolver}/01/{gtin}`, or a Passidex resolver URI when there's no
GTIN) and a compliance block listing any still-missing required fields. It's a
pure projection over stored data — when the EU DPP Registry finalises its schema,
only this serializer changes, not the model.

## Getting started

```bash
pnpm install

# Backend (needs a PostgreSQL instance — see .env.example)
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev:api          # http://localhost:3001

# Frontend
pnpm dev:web          # http://localhost:5173
```

## Tech stack

- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** NestJS (TypeScript), Prisma
- **Database:** PostgreSQL (EU-hosted)
- **Async jobs / reminders:** pg-boss (Phase 2)
- **Email:** Postmark transactional + inbound (Phase 2)
- **AI parsing:** Anthropic Claude, native PDF/image/spreadsheet understanding (Phase 3)
- **Object storage:** S3-compatible, EU region (Phase 3)
