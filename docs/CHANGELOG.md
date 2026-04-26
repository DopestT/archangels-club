# Archangels Club — Changelog

Every code change is appended here. Format: date/time (ET), then Added/Fixed/Changed/Notes sections.
Only include sections that apply to a given entry.

---

## [2026-04-26 - 04:44]

### Added
- Fan demo account in `seedDemo.ts` (`demo.fan@archangels.demo`, role=fan, status=approved)
- `useNavigate` to `LockedContentPage` so unauthenticated unlock attempts redirect to `/login?next=...`

### Fixed
- `handleUnlock()` silently returned on `!token` — now redirects to login
- `fetchAccess()` polled `/my-access` 5× with no user feedback on exhaustion — now sets visible error message after last retry
- Tip/subscription `startCheckout()` had no console output — added `console.log` at request start, response, redirect, and catch

### Changed
- `handleUnlock` and `fetchAccess` in `LockedContentPage.tsx` — full console logging
- `startCheckout` in `CreatorProfilePage.tsx` — full console logging

### Notes
- Fan account needed because demo seed only contained creator accounts; purchase flow requires an approved fan

---

## [2026-04-26 - 04:34]

### Fixed
- `LockedContentPage`: metadata fetch error (`data.error`, network failure) no longer sets `error` state
- Null-content screen now reads "Unlock to view this drop" instead of "Failed to load content"
- `useNavigate` already present; `error` state preserved for payment errors inside lock overlay

### Notes
- Prior behavior: any fetch failure (including stale `API_BASE = ''` before the Railway fix) showed hard error screen
- `media_url` was already correctly withheld until post-unlock; no logic change to that path

---

## [2026-04-26 - 04:29]

### Fixed
- Horizontal scroll strips on Explore page (Trending, Locked Drops, New & Rising, You Might Like)
  - `FeedStrip` rewritten: `overflow-x-auto overflow-y-hidden snap-x snap-mandatory`
  - Cards set to `flex-none w-[260px] snap-start`
  - Scrollbar hidden via `.no-scrollbar`
  - `-webkit-overflow-scrolling: touch` for iOS momentum scroll
- Added left/right arrow buttons on desktop (`hidden lg:flex`), shown on hover via `group/strip`
  - Each click scrolls container ±320px smoothly
- Removed `-mx-4 px-4` negative-margin trick that was interfering with `overflow-x`

### Changed
- `FeedStrip` component in `ExplorePage.tsx` — complete rewrite
- Added `ChevronLeft` to lucide-react imports

---

## [2026-04-26 - 04:10]

### Fixed
- All 14 `API_BASE` declarations fell back to `''` when `VITE_API_URL` is unset on Vercel
  — every API call hit `https://archangelsclub.vercel.app/api/...` (no backend) and threw network errors
- Changed fallback in all 13 affected files from `?? ''` to `?? 'https://archangels-club-production.up.railway.app'`
- Vite dev proxy still works locally because `VITE_API_URL` is unset in `.env.local`, and `??` (not `||`) preserves the empty-string proxy path

### Notes
- Root cause of "Unable to reach the server" on Tip and "Failed to load content" on locked items

---

## [2026-04-26 - 03:05]

### Fixed
- `seedDemo.ts` `ON CONFLICT (user_id)` on `creator_profiles` upsert failed because `user_id` had no unique constraint
  — changed upsert to `ON CONFLICT (id)` (deterministic primary key, always safe)
- Added `DO $$ BEGIN ... IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_creator_profiles_user_id') THEN ALTER TABLE creator_profiles ADD CONSTRAINT ... UNIQUE (user_id); END IF; END $$` to migration

### Notes
- PostgreSQL does not support `ADD CONSTRAINT IF NOT EXISTS` syntax — must use the `DO $$ BEGIN` idiom

---

## [2026-04-26 - 02:22]

### Fixed
- Admin approval crashed with `duplicate key value violates unique constraint users_username_key`
  — deriving username from email prefix with no collision check caused constraint violation
  — added `generateUniqueUsername()` helper in `admin.ts` that loops adding numeric suffixes until a free slot is found
- Content API query used `cu.created_at` which does not exist in `content_unlocks` — the column is `unlocked_at`
  — fixed query in `content.ts` line 53 to use `cu.unlocked_at`
  — added migration: `ALTER TABLE content_unlocks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()` + backfill

---

## [2026-04-25 - 23:19]

### Fixed
- Removed `SAMPLE_REVIEWS` hardcoded array from `CreatorProfilePage.tsx`
- Reviews tab now shows real empty state
- Admin sidebar removed dead nav links (Payouts, Notifications, Settings — no pages exist)
- `AdminDashboard` chart stats now use real API values instead of hardcoded `$144,200` etc.
- Real transactions display (replaces 4 hardcoded fake entries)

---

## [2026-04-25 - 23:01]

### Fixed
- All `href="#"` and `to="#"` placeholder links across app replaced with real routes or removed
- Footer dead links wired to `/privacy`, `/terms`, `/compliance`, `/dmca`
- Admin sidebar wired to `/admin/flagged`, `/admin/transactions`, `/admin/keys`
- Added missing routes in `App.tsx`: `admin/flagged`, `admin/transactions`, `admin/keys` pointing to `AdminDashboard` with `initialTab` prop

---

## [2026-04-25 - 18:17]

### Fixed
- Bell notification icon opened a black screen — `apiFetch` was using wrong `localStorage` key (`arc_token` vs `arc_auth`)

---

## [2026-04-25 - 18:12]

### Added
- `npm run seed:demo` script (`server/src/db/seedDemo.ts`)
- 3 demo creators: Aria Luxe (@arialuxe, $14.99/mo), Selena Noir (@selenanoir, $12.99/mo), Elara Moon (@elaramoon, $9.99/mo)
- 5 content items per creator (mix of locked, free, subscriber-only)
- All demo accounts: password `DemoPass123!`, status=approved, role=creator

---

## [2026-04-25 - 17:57]

### Added
- `FeedCard` component: full-bleed aspect-ratio card with blur-reveal hover, video preview, lock overlay
- `ContentCard`: blur teaser (13px at rest → 4px on hover), 5s video preview on hover
- Urgency badges: "Almost Gone", "Trending", "New" on content cards
- Seeded viewer counts (`seededViewers()` — deterministic from content ID)

---

## [2026-04-25 - 17:40]

### Added
- `LiveActivity` component: toast notifications of recent unlocks/purchases on Explore page
- `GET /api/activity/recent` endpoint returning last 10 transactions

---

## [2026-04-25 - 17:29]

### Added
- Content ranking system: `score` column computed from `unlock_count * 3 + content_revenue * 5 + recent_unlocks_24h * 4 + new_bonus`
- `sort=trending` and `sort=rising` query params on `GET /api/content`
- "Trending Now", "Locked Drops", "New & Rising", "You Might Like" sections on Explore

---

## [2026-04-25 - 17:03]

### Added
- Infinite-scroll feed on Explore (`IntersectionObserver` sentinel, page size 12)
- `FeedStrip` horizontal scroll component (initial version)

---

## [2026-04-25 - 16:41 – 2026-04-25 - 16:52]

### Changed
- High-conversion UI upgrade: creator profile page, explore, checkout, empty states
- `LockedContentPage` paywall redesign with blur preview, price, unlock CTA
- Subscription upsell block on content pages

---

## [2026-04-25 - 15:28]

### Fixed
- Creator account creation flow end-to-end
- `POST /api/admin/creators/:id/generate-setup-link` creates approved user + sends set-password link

---

## [2026-04-25 - 08:08]

### Added
- Stripe checkout for tips (`POST /api/stripe/checkout` with `type: 'tip'`)
- Stripe checkout for subscriptions (`POST /api/stripe/checkout` with `type: 'subscription'`)
- Stripe webhook handler (`POST /api/webhooks/stripe`) for `checkout.session.completed`
  - Records transactions, creates subscription records, inserts content_unlocks rows

---

## [2026-04-25 - 07:45]

### Added
- Approval → set-password onboarding flow
- `POST /api/auth/set-password` endpoint
- `SetPasswordPage` frontend page at `/set-password`
- Admin sends magic link on approval that lands user at `/set-password?token=...`
