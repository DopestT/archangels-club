# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Archangels Club is a members-only creator platform (OnlyFans-style). It is a monorepo with:
- `client/` — React 18 + Vite + Tailwind SPA, deployed on Vercel
- `server/` — Express + TypeScript API, deployed on Railway
- PostgreSQL on [Neon](https://neon.tech) (serverless)

## Commands

All commands are run from the repo root unless otherwise noted.

```bash
# Type-check + lint both packages
npm run check

# Run server unit tests (Vitest, no DB required — DB is fully mocked)
npm run test

# Run a single test file
cd server && npx vitest run src/tests/routes.test.ts

# Run a single test by name
cd server && npx vitest run --reporter=verbose -t "POST /api/auth/login"

# Lint only
npm run lint

# Type-check only
npm run typecheck

# Start dev servers (run each in a separate terminal)
cd server && npm run dev          # port 5051
cd client && npm run dev          # port 3000 (proxies /api → 5051)

# Build client for production
cd client && npm run build

# Run Playwright e2e tests (against production URLs by default)
npm run test:e2e

# Seed demo data
cd server && npm run seed:demo

# Create an admin user
cd server && npm run create-admin

# Full pre-ship verification (type + lint + unit + build + API smoke + e2e)
npm run bug:squash
```

## Environment Setup

Copy `.env.example` to `server/.env`. Required variables at startup:
- `DATABASE_URL` — Neon pooled connection string
- `JWT_SECRET` — minimum 32 chars
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`

Recommended (features degrade without them): `CLOUDINARY_*`, `ADMIN_KEY`, `RESEND_API_KEY`, `TWILIO_*`.

The `STRIPE_SECRET_KEY` must be set even in development; the test suite injects `sk_test_fake_for_unit_tests` automatically via `vitest.config.ts`.

Migrations run automatically on server startup (`runMigrations()` in `src/db/migrate.ts`). Never run a separate migration step.

## Architecture

### Server (`server/src/`)

**Entry point:** `src/index.ts` — mounts all routers under `/api/*`. Stripe webhooks are mounted before `express.json()` because they need the raw body for signature verification.

**Database client:** `src/db/client.ts` exports four typed helpers used throughout all routes:
- `query<T>` — returns all rows
- `queryOne<T>` — returns first row or null
- `execute` — INSERT/UPDATE/DELETE, returns row count
- `withTransaction` — wraps a callback in BEGIN/COMMIT, retries on deadlock (up to 3×)

Import from `'../db/schema.js'` (the re-export barrel), not directly from `client.js`, unless you're in `services/`.

**Schema / migrations:** `src/db/migrate.ts` contains one large idempotent DDL string using `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and conditional `DO $$ BEGIN ... END $$` blocks. When adding new tables or columns, always append to this file — never modify existing `CREATE TABLE` blocks.

**Authentication middleware** (`src/middleware/auth.ts`):
- `optionalAuth` — attaches `req.auth` if a valid JWT is present, never blocks
- `requireAuth` — requires a JWT or `X-Admin-Key` header
- `requireCreator` — re-queries DB role so newly-approved creators don't need to re-login
- `requireApproved`, `requireAgeVerified`, `requireAdmin` — composable guards

JWTs are signed with `JWT_SECRET` and expire in 30 days. Admins can also authenticate via the `X-Admin-Key` header (rate-limited to 5 attempts/minute/IP).

**Services layer** (`src/services/`): Business logic called by routes. Key services:
- `fulfillment.ts` — idempotent Stripe checkout fulfillment (see Payment System below)
- `events.ts` — `logEvent()` and `recordSignal()` are fire-and-forget; they catch all errors and never crash their callers
- `intelligence.ts`, `recommendations.ts` — ABMIE-X intelligence layer
- `triggers.ts` — email/SMS notification triggers on platform events

### Client (`client/src/`)

**Routing:** All routes nest under a single `<AppShell>` outlet in `App.tsx`. Pages are lazy-loaded. Access control is enforced client-side by `<ProtectedRoute>` with three flags: `requireApproved`, `requireCreator`, `requireAdmin`. Server enforces the same rules independently.

**Auth state:** `AuthContext` stores `{ token, user }` in `localStorage` under key `arc_auth`. The `refreshUser()` function re-fetches `/api/auth/me` to pick up role changes (e.g., after admin approves a creator application) without requiring re-login.

**API calls:** All authenticated requests go through `src/lib/api.ts:apiFetch()`, which reads the JWT from localStorage and attaches it as `Authorization: Bearer <token>`. In dev, `VITE_API_URL` is empty and Vite proxies `/api` to port 5051.

**i18n:** 8 languages (en/es/fr/de/ja/pt/vi/zh) via `src/i18n/`. UI strings use the `LanguageContext` hook. All new user-visible strings must be added to all language files.

**UI components:** Reusable primitives in `src/components/ui/`. Domain components are grouped by subdirectory (admin/, content/, creator/, commerce/, etc.). Use existing UI primitives (`Button`, `Input`, `Modal`, `Toast`, `Badge`) rather than creating new ones.

## User Roles and Status

**Roles:** `fan` | `creator` | `both` | `admin`

**Statuses:** `pending` → `approved` (or `rejected` / `suspended` / `banned`). New signups start as `pending` until admin approval. Admin bypasses all status gates.

Content goes through: `draft` → `pending_review` → `approved` (or `rejected` / `changes_requested` / `scheduled`). Creators can soft-delete content by setting status to `removed`; hard deletion is blocked by FK constraints if the content has been purchased.

## Payment System (Stripe)

Platform takes 30% of all transactions. The fulfillment flow handles three purchase types: `subscription`, `unlock`, `tip`.

**Critical invariant:** `fulfillment.ts:fulfillCheckoutSession()` is the single entry point for all post-payment DB writes. It is called from two places:
1. `routes/webhooks.ts` — Stripe webhook `checkout.session.completed`
2. `routes/checkout.ts` — `/api/checkout/session/:id` (client polling after redirect)

Both paths are safe to call concurrently because:
- `fulfillment_records` uses `ON CONFLICT (stripe_session_id) DO UPDATE` to serialize concurrent calls
- `transactions` has a partial UNIQUE index on `stripe_session_id` to prevent double-inserts
- PostgreSQL unique violation (`23505`) is caught and treated as idempotent success

The `payment_events` table is an audit ledger; `fulfillment_records` tracks fulfillment state; `transactions` is the financial record.

**Do not add synchronous DB writes inside the Stripe webhook critical path.** The `logEvent()` / `recordSignal()` calls after fulfillment use `.catch(() => {})` and must remain that way.

## ABMIE-X Intelligence System

ABMIE-X (Archangels Club Behavioral and Member Intelligence Engine) provides creator coaching, recommendations, and health scoring. Key principle: **no AI call is required for any page to render** — every surface has a factual data fallback.

**Event pipeline:**
1. Client fires `POST /api/events` with an `event_type` from `ALLOWED_EVENTS` (defined in `routes/events.ts`)
2. Server calls `logEvent()` → writes to `platform_events`
3. Fulfillment calls `recordSignal()` → writes to `engagement_signals` with weighted signal strength

**When adding a new event type:** add it to both `ALLOWED_EVENTS` in `routes/events.ts` AND `EventType` in `services/events.ts`.

**Creator health scores** are computed in `services/creatorHealth.ts` and cached in `creator_health_scores`. They auto-refresh when stale (>1 hour) on `GET /api/pulse/my-health`.

**Recommendations** are in `services/recommendations.ts` / `services/memberRecommendations.ts` with 5-min global / 10-min per-user caching. Safe to call on every dashboard load.

## Testing

**Unit tests** (`server/src/tests/`): Use Vitest + Supertest. All DB calls are mocked via `vi.mock('../db/schema.js', ...)`. Stripe, email, and SMS services are also mocked. Tests do not require a real database or Stripe account.

**E2e tests** (`client/tests/e2e/`): Playwright against production URLs (`https://www.archangelsclub.com`). Controlled by `PLAYWRIGHT_BASE_URL` and `API_BASE_URL` env vars.

**Stress tests** (`server/src/tests/stress.test.ts`): Test concurrent fulfillment races — run these before any changes to the payment/fulfillment path.

## Key Conventions

- **IDs** are generated with `crypto.randomUUID()` on the server, `nanoid()` in services/events.
- **Money** is stored as `NUMERIC(12,2)` in dollars (not cents) in `transactions` and `creator_profiles.total_earnings`. Stripe amounts are in cents — divide by 100 before writing to DB.
- **Timestamps** are `TIMESTAMPTZ` throughout. Subscription expiry defaults to `NOW() + 30 days` unless Stripe provides a `current_period_end`.
- **Cloudinary** handles media uploads; `multer` is used only as the multipart parser before uploading to Cloudinary.
- **Stripe Connect** fields exist on `creator_profiles` (`stripe_account_id`, `stripe_onboarding_complete`) but creator payout flow is not fully implemented.

## Deployment

- **Backend:** Railway, root directory `server/`, auto-deploys from `main`. Migrations run on startup.
- **Frontend:** Vercel, root directory `client/`. `VITE_API_URL` must point to the Railway URL.
- **Stripe webhooks:** must be configured to send to `<railway-url>/api/webhooks`.
- Frontend deploy script: `deploy-frontend.sh` (builds and deploys client via Vercel CLI).
