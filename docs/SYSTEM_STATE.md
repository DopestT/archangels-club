# Archangels Club — System State

Last updated: 2026-04-26 (05:20 ET)

This document reflects the current state of the entire system. Update it whenever a major change ships.

---

## Deployments

| Layer | Platform | URL |
|---|---|---|
| Frontend | Vercel | https://www.archangelsclub.com |
| Backend | Railway | https://archangels-club-production.up.railway.app |
| Database | Railway (PostgreSQL) | shortline.proxy.rlwy.net:29047 (public endpoint) |
| Payments | Stripe (test mode) | Dashboard: dashboard.stripe.com |

---

## Environment Variables

### Railway (server)
| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Internal Railway Postgres URL |
| `DATABASE_PUBLIC_URL` | ✅ | Public URL for running seed from Mac |
| `PORT` | ✅ | Set by Railway automatically |
| `JWT_SECRET` | ✅ | Signs auth tokens |
| `STRIPE_SECRET_KEY` | ✅ | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | ⚠️ | Required for webhook signature verification; if unset, webhook accepts any body |
| `CLIENT_URL` | ✅ | `https://www.archangelsclub.com` — used in CORS + Stripe success/cancel URLs |

### Vercel (client)
| Variable | Notes |
|---|---|
| `VITE_API_URL` | Optional. If unset, frontend falls back to Railway URL hardcoded in source. Set to `https://archangels-club-production.up.railway.app` |

---

## Frontend Routes

All routes are in `client/src/App.tsx`.

### Public (no auth required)
| Path | Component | Notes |
|---|---|---|
| `/` | `LandingPage` | Public landing, shows request-access form |
| `/explore` | `ExplorePage` | Browse creators + content; no auth needed |
| `/creator/:username` | `CreatorProfilePage` | Creator profile, content list, tip/subscribe CTAs |
| `/content/:id` | `LockedContentPage` | Content paywall; shows preview + unlock CTA |
| `/login` | `AuthPage (login)` | |
| `/signup` | `AuthPage (signup)` | = request-access flow |
| `/request-access` | `AuthPage (signup)` | Alias |
| `/set-password` | `SetPasswordPage` | Used after admin approval; token in query string |
| `/privacy` | `StaticPage` | |
| `/terms` | `StaticPage` | |
| `/compliance` | `StaticPage` | |
| `/dmca` | `StaticPage` | |
| `/age-verification` | `StaticPage` | |
| `/contact` | `StaticPage` | |
| `/report` | `StaticPage` | |
| `/help` | `StaticPage` | |

### Auth-required (any approved user)
| Path | Component |
|---|---|
| `/pending` | Pending approval screen |
| `/access-denied` | Blocked/suspended screen |
| `/dashboard` | Member dashboard |
| `/messages` | Messages/inbox |
| `/apply-creator` | Creator application form |
| `/keys` | Access keys vault |
| `/notifications` | Notifications list |
| `/success` | Post-payment success page |
| `/cancel` | Payment cancelled page |

### Creator-only
| Path | Component |
|---|---|
| `/creator` | Creator dashboard |
| `/creator/dashboard` | Creator dashboard (alias) |
| `/upload` | Upload content |
| `/creator/onboarding` | Stripe Connect onboarding |

### Admin-only
| Path | Component |
|---|---|
| `/admin` | AdminDashboard (overview tab) |
| `/admin/access-requests` | Access request queue |
| `/admin/content-approvals` | Content review queue |
| `/admin/creator-approvals` | Creator application queue |
| `/admin/flagged` | Reports / flagged content |
| `/admin/transactions` | Transaction ledger |
| `/admin/keys` | Access key management |
| `/admin/control-center` | Admin Control Center |

---

## Backend API Endpoints

Base URL: `https://archangels-club-production.up.railway.app`

### Auth — `/api/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | none | Register new user (access-request flow) |
| POST | `/login` | none | Login → returns JWT + user object |
| POST | `/set-password` | none | Set password from approval token |
| GET | `/me` | JWT | Return current user |

### Access Requests — `/api/access-request`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | none | Health check |
| POST | `/` | none | Submit access request (signup form) |

### Creators — `/api/creators`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | none | List approved creators (with search/sort/tag filters) |
| POST | `/apply` | JWT | Submit creator application |
| GET | `/my/stats` | JWT+creator | Creator earnings stats |
| GET | `/my/transactions` | JWT+creator | Creator transaction history |
| GET | `/my/requests` | JWT+creator | Creator custom requests |
| GET | `/:username` | none | Get creator profile by username |
| GET | `/:username/content` | none | Get creator's approved content |
| PATCH | `/profile` | JWT+creator | Update creator bio/tags/price |

### Content — `/api/content`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | none | Browse approved content (sort, filter, paginate) |
| GET | `/:id` | none | Get content metadata (media_url stripped if locked) |
| GET | `/:id/my-access` | JWT | Check unlock status; returns `{ unlocked, media_url, is_subscribed, discounted_price }` |
| POST | `/` | JWT+creator | Upload new content (enters pending_review) |
| POST | `/:id/unlock` | JWT+approved | Direct unlock (used post-webhook; creates transaction + unlock record) |

### Payments — `/api/payments`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/create-unlock-session` | JWT+approved | Create Stripe Checkout session for content unlock → returns `{ url }` |

### Stripe — `/api/stripe`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/test` | none | Verify Stripe key connectivity |
| GET | `/connect/status` | JWT+creator | Creator's Stripe Connect status |
| POST | `/connect/start` | JWT+creator | Create Express account + return onboarding URL |
| POST | `/connect/verify` | JWT+creator | Check if Connect onboarding is complete |
| POST | `/connect/dashboard-link` | JWT+creator | Generate Express dashboard login link |
| POST | `/checkout` | JWT | Create tip or subscription checkout session → `{ url }` |

### Webhooks — `/api/webhooks`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/stripe` | Stripe sig | Handle `checkout.session.completed` for unlock/tip/subscription |

### Admin — `/api/admin`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stats` | none | Platform stats (total users, revenue, etc.) |
| GET | `/access-requests` | none | All pending access requests |
| POST | `/users/:id/approve` | none | Approve user → create user record + send set-password email |
| POST | `/reprocess-approved` | none | Re-run approval logic for already-approved access requests |
| POST | `/users/:id/reject` | none | Reject access request |
| POST | `/users/:id/request-more-info` | none | Ask applicant for more info |
| POST | `/users/:id/suspend` | none | Suspend user |
| POST | `/creators/:id/approve` | none | Approve creator application |
| POST | `/creators/:id/reject` | none | Reject creator application |
| POST | `/creators/:id/generate-setup-link` | none | Generate/resend set-password link for creator |
| POST | `/creators/:id/request-more-info` | none | Request more info from creator applicant |
| POST | `/creators/:id/suspend` | none | Suspend creator |
| POST | `/content/:id/approve` | none | Approve content for publishing |
| POST | `/content/:id/reject` | none | Reject content |
| POST | `/content/:id/request-changes` | none | Request changes on content |
| POST | `/content/:id/remove` | none | Remove published content |
| GET | `/reports` | none | Flagged content/user reports |
| POST | `/reports/:id/dismiss` | none | Dismiss report |
| POST | `/reports/:id/take-action` | none | Action a report |
| POST | `/reports/:id/escalate` | none | Escalate report |
| PATCH | `/users/:id/status` | none | Update user status |
| GET | `/creators/pending` | none | Pending creator applications |
| PATCH | `/creators/:id/status` | none | Update creator application status |
| GET | `/content-approvals` | none | Pending content for review |
| PATCH | `/content/:id/status` | none | Update content status |
| GET | `/transactions` | none | All transactions |
| GET | `/users` | none | All users |
| POST | `/promote-to-admin` | none | Promote user to admin role |

### Messages — `/api/messages`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | JWT | Inbox (all conversations) |
| GET | `/my-requests` | JWT | Custom requests for/from current user |
| GET | `/:partnerId` | JWT | Conversation with a specific user |
| POST | `/` | JWT | Send message |
| POST | `/custom-request` | JWT | Create custom content request |

### Notifications — `/api/notifications`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | JWT (via query param) | List notifications for user |
| GET | `/unread-count` | JWT (via query param) | Count of unread notifications |
| GET | `/preferences` | JWT (via query param) | User notification preferences |

### Access Keys — `/api/keys`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/vault` | JWT+approved | User's key vault |
| POST | `/transfer` | JWT+approved | Transfer a key to another user |
| GET | `/drops` | JWT+approved | Available key drops |
| POST | `/drops/:id/claim` | JWT+approved | Claim a key from a drop |
| GET | `/exchange` | JWT+approved | Key exchange listings |
| POST | `/:id/list` | JWT+approved | List a key for exchange |
| POST | `/admin/issue` | JWT+admin | Issue keys to users |
| POST | `/admin/drops` | JWT+admin | Create a new key drop event |

### Activity — `/api/activity`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/recent` | none | Last 10 transactions (for live activity toasts on Explore) |

---

## Database Schema

PostgreSQL on Railway. Tables created/migrated via `server/src/db/migrate.ts` (run on every server start).

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `email` | TEXT UNIQUE | |
| `username` | TEXT UNIQUE | |
| `password_hash` | TEXT | Nullable (set via set-password flow) |
| `display_name` | TEXT | |
| `avatar_url` | TEXT | |
| `phone` | TEXT | |
| `role` | TEXT | `fan` / `creator` / `both` / `admin` |
| `status` | TEXT | `pending` / `approved` / `rejected` / `suspended` / `banned` |
| `is_verified_creator` | SMALLINT | 0/1 |
| `date_of_birth` | TEXT | |
| `reason_for_joining` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

### `creator_profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `user_id` | TEXT FK → users | UNIQUE constraint (one profile per user) |
| `bio` | TEXT | |
| `cover_image_url` | TEXT | |
| `tags` | TEXT | JSON array stored as text |
| `content_categories` | TEXT | JSON array stored as text |
| `subscription_price` | NUMERIC(12,2) | |
| `starting_price` | NUMERIC(12,2) | |
| `is_approved` | SMALLINT | 0/1 |
| `application_status` | TEXT | `pending` / `approved` / `rejected` / `suspended` |
| `pitch` | TEXT | Application pitch text |
| `total_earnings` | NUMERIC(12,2) | Running total, updated on each sale |
| `stripe_account_id` | TEXT | Stripe Express account ID |
| `stripe_onboarding_complete` | SMALLINT | 0/1 |
| `created_at` | TIMESTAMPTZ | |

### `content`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `creator_id` | TEXT FK → creator_profiles | |
| `title` | TEXT | |
| `description` | TEXT | |
| `content_type` | TEXT | `image` / `video` / `audio` / `text` |
| `access_type` | TEXT | `free` / `locked` / `subscribers` |
| `preview_url` | TEXT | Always visible; used for blur-reveal teaser |
| `media_url` | TEXT | Full content; only returned after unlock |
| `price` | NUMERIC(12,2) | 0 for free/subscriber content |
| `status` | TEXT | `draft` / `pending_review` / `approved` / `rejected` / `removed` / `changes_requested` |
| `max_unlocks` | INTEGER | Optional cap; null = unlimited |
| `current_unlocks` | INTEGER | Running count |
| `available_until` | TIMESTAMPTZ | Optional expiry |
| `subscriber_discount_pct` | INTEGER | |
| `created_at` | TIMESTAMPTZ | |

### `content_unlocks`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `user_id` | TEXT FK → users | |
| `content_id` | TEXT FK → content | |
| `transaction_id` | TEXT FK → transactions | Added via migration |
| `unlocked_at` | TIMESTAMPTZ | Original column |
| `created_at` | TIMESTAMPTZ | Added via migration; backfilled from `unlocked_at` |
| UNIQUE | `(user_id, content_id)` | Prevents duplicate unlocks |

### `transactions`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `payer_id` | TEXT FK → users | |
| `payee_id` | TEXT FK → users | |
| `ref_type` | TEXT | `content` / `tip` / `subscription` / `custom_request` |
| `ref_id` | TEXT | ID of the referenced entity |
| `amount` | NUMERIC(12,2) | Gross amount charged |
| `platform_fee` | NUMERIC(12,2) | 20% of amount |
| `net_amount` | NUMERIC(12,2) | amount − platform_fee |
| `status` | TEXT | `pending` / `completed` / `failed` / `refunded` / `disputed` |
| `stripe_payment_intent_id` | TEXT | Added via migration |
| `created_at` | TIMESTAMPTZ | |

### `subscriptions`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `subscriber_id` | TEXT FK → users | |
| `creator_id` | TEXT FK → creator_profiles | |
| `status` | TEXT | `active` / `cancelled` / `expired` |
| `started_at` | TIMESTAMPTZ | |
| `expires_at` | TIMESTAMPTZ | |
| UNIQUE | `(subscriber_id, creator_id)` | |

### Other tables
- `bundles` / `bundle_contents` — content bundles (not yet used in UI)
- `custom_requests` — fan → creator content requests
- `messages` — direct messages (linked to custom_requests optionally)
- `access_keys` — invite keys (`standard` / `gold` / `black`)
- `key_drops` — timed key drop events
- `key_drop_claims` — claims from key drops
- `referrals` — referral tracking
- `key_listings` — key exchange listings
- `notifications` — in-app / email / SMS notifications
- `notification_preferences` — per-user notification settings
- `reports` — user/content reports
- `admin_actions` — admin action log
- `access_requests` — pre-registration request queue
- `password_resets` — password reset tokens

---

## Monetization Flow

### Content Unlock (pay-per-item)
```
User visits /content/:id
  → GET /api/content/:id — metadata fetched (media_url stripped if locked)
  → GET /api/content/:id/my-access (if authenticated)
    → returns { unlocked, media_url, is_subscribed, discounted_price }
    → if is_subscribed + discounted_price set: lock overlay shows discounted price with strikethrough original
  → User clicks "Unlock Access · $X.XX"
    → handleUnlock() in LockedContentPage
    → if not authenticated: redirect to /login?next=/content/:id
    → POST /api/payments/create-unlock-session { content_id }
      → validates content exists, is approved, is locked, has price > 0
      → checks if already unlocked (returns { already_unlocked: true } if so)
      → queries subscriptions table — applies subscriber_discount_pct if active sub found
      → creates Stripe Checkout Session (payment mode) at effectivePrice
      → if creator has Stripe Connect: routes 80% to creator via transfer_data
      → if no Connect: full amount to platform
      → metadata.amount = effectivePrice (discounted amount, not base price)
      → returns { url: stripeCheckoutUrl }
    → window.location.href = url (redirect to Stripe)
  → User pays on Stripe
  → Stripe calls POST /api/webhooks/stripe (checkout.session.completed)
    → reads metadata: { user_id, content_id, creator_user_id, creator_profile_id, amount }
    → idempotency check (skip if unlock row already exists)
    → INSERT INTO transactions (amount = metadata.amount = actual charged amount)
    → INSERT INTO content_unlocks
    → UPDATE creator_profiles SET total_earnings += net_amount
  → Stripe redirects to /content/:id?payment=success
  → fetchAccess() polls GET /api/content/:id/my-access up to 5× at 2s intervals
  → on success: { unlocked: true, media_url } → content shown
  → on exhaustion: shows "Payment received — access being confirmed"
```

**Platform fee:** 20% of effective (post-discount) price
**Stripe Connect required for creator payout:** optional — if not set up, payment goes to platform

### Subscription Model
Subscriptions do **not** unlock all paid content. They provide:
- Access to `access_type = 'subscribers'` posts (exclusive subscriber-only content)
- A percentage discount (`subscriber_discount_pct`) on `access_type = 'locked'` (paid) content
- Discounted price is shown with strikethrough on lock overlay when `is_subscribed = true`

Subscription scope is per-creator. `subscriptions` table: `status = 'active' AND expires_at > NOW()`.

### Tip
```
User on creator profile → tip panel → selects amount → "Send $X Tip →"
  → startCheckout('tip') in CreatorProfilePage
  → POST /api/stripe/checkout { type: 'tip', creatorId, amount }
    → creates Stripe Checkout Session (payment mode)
    → if creator has Connect: routes 80% to creator
    → returns { url }
  → window.location.href = url
  → Stripe webhook: records transaction + updates total_earnings
  → Stripe redirects to /creator/:username?payment=success&type=tip
```

### Subscription
```
User on creator profile → "Subscribe · $X.XX / mo"
  → startCheckout('subscription')
  → POST /api/stripe/checkout { type: 'subscription', creatorId }
    → creates Stripe Checkout Session (subscription mode, recurring monthly)
    → returns { url }
  → window.location.href = url
  → Stripe webhook: creates subscription record (30-day expiry), records transaction
  → Stripe redirects to /creator/:username?payment=success&type=subscription
```

---

## Auth Flow

```
New user:
  POST /api/access-request → creates access_requests row (status=pending)
  Admin approves → POST /api/admin/users/:id/approve
    → generates username (collision-safe)
    → INSERT INTO users (status=approved)
    → sends set-password email with token
  User clicks link → /set-password?token=...
    → POST /api/auth/set-password → sets password_hash
  User logs in → POST /api/auth/login → returns JWT
  JWT stored in localStorage as { token, user } under key 'arc_auth'
  isApproved = user.status === 'approved' (read from stored user object)
```

---

## Demo Accounts

All demo accounts use password: `DemoPass123!`

| Email | Username | Role | Status | Purpose |
|---|---|---|---|---|
| demo.arialuxe@archangels.demo | arialuxe | creator | approved | Demo creator — fashion/photography |
| demo.selenanoir@archangels.demo | selenanoir | creator | approved | Demo creator — dark aesthetic |
| demo.elaramoon@archangels.demo | elaramoon | creator | approved | Demo creator — lifestyle/wellness |
| demo.fan@archangels.demo | demofan | fan | approved | Demo fan — use to test purchase flow |

Run to seed: `cd server && DATABASE_URL=<public-railway-url> npm run seed:demo`

---

## Known Constraints / Watch Points

1. **Stripe webhook must be registered** in Stripe dashboard pointing to `https://archangels-club-production.up.railway.app/api/webhooks/stripe` for events: `checkout.session.completed`. Without this, content unlock records are never created after payment.

2. **`isApproved` reads from stale localStorage** — if admin approves a user while they're logged in, they must log out and back in for `isApproved` to update. No `/api/auth/me` refresh on page load.

3. **`media_url` is null for all demo content** — demo seed inserts `media_url = NULL`. After unlock, `/my-access` returns `{ unlocked: true, media_url: null }`. Content players render nothing. Real content needs actual media URLs.

4. **Creator payout requires Stripe Connect** — if creator hasn't completed Express onboarding, their share of payments accumulates in the platform Stripe account, not disbursed automatically.

6. **Subscription discount only applies to `locked` content** — `subscriber_discount_pct` is applied only when `access_type = 'locked'`. Subscriber-only (`access_type = 'subscribers'`) content is free to active subscribers; free (`access_type = 'free'`) content needs no discount.

7. **`discounted_price` only returned when discount > 0** — `/my-access` returns `discounted_price: null` if `subscriber_discount_pct = 0` or user is not subscribed. Frontend falls back to `content.price` when null.

8. **Admin endpoints have no auth guard** — `/api/admin/*` routes currently accept requests without a JWT. Acceptable for private beta; must be locked before public launch.
