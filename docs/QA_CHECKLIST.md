# Archangels Club — QA Checklist

Permanent manual testing checklist. Run before every release and after every major change.
Update the **Known Issues** section whenever a test fails and no fix is immediately applied.

---

## How to use

- Check each box when the test passes.
- Write the result in the **Pass / Fail / Notes** column.
- Reset all checkboxes before the next test run (replace `[x]` with `[ ]`).
- Date and sign off the run at the top of each section.

---

## 1. Deployment Verification

**Date:** ________ | **Tester:** ________

| # | Test | Expected Result | Pass / Fail / Notes |
|---|------|-----------------|---------------------|
| 1.1 | Latest local commit matches `git log --oneline -1` output | SHA on local matches remote | |
| 1.2 | GitHub repo shows latest commit in `main` branch | Commit SHA matches local | |
| 1.3 | Vercel dashboard → Deployments → latest deploy is from latest commit | Vercel build status = Ready, SHA matches | |
| 1.4 | Vercel production URL (`https://www.archangelsclub.com`) loads without 404 or blank screen | Landing page renders | |
| 1.5 | Railway dashboard → latest deploy is live | Service shows "Active", no crash loops | |
| 1.6 | `GET https://archangels-club-production.up.railway.app/api/creators` returns JSON array | HTTP 200, array of creator objects | |

- [ ] 1.1 Latest local commit pushed to GitHub
- [ ] 1.2 GitHub `main` branch reflects latest commit
- [ ] 1.3 Vercel production build is from latest commit
- [ ] 1.4 Production frontend loads
- [ ] 1.5 Railway backend is live
- [ ] 1.6 Backend health check passes

**Railway env vars to confirm are set:**
- [ ] `DATABASE_URL` present
- [ ] `JWT_SECRET` present
- [ ] `STRIPE_SECRET_KEY` present (`sk_test_...`)
- [ ] `STRIPE_WEBHOOK_SECRET` present
- [ ] `CLIENT_URL` = `https://www.archangelsclub.com`

**Vercel env vars to confirm are set:**
- [ ] `VITE_API_URL` = `https://archangels-club-production.up.railway.app` (or hardcoded fallback confirmed working)

---

## 2. Public User Flow

**Date:** ________ | **Tester:** ________

| # | Test | Expected Result | Pass / Fail / Notes |
|---|------|-----------------|---------------------|
| 2.1 | Navigate to `https://www.archangelsclub.com` | Landing page loads; no console errors | |
| 2.2 | Landing page shows hero, CTA buttons, creator previews | All sections visible, no broken images | |
| 2.3 | Click "Request Access" / "Join" CTA | Signup form appears | |
| 2.4 | Submit signup form with valid name, email, reason | Success message shown; no error | |
| 2.5 | Submit signup form with duplicate email | Error message shown; no crash | |
| 2.6 | Submit signup form with empty required fields | Validation error shown | |
| 2.7 | Navigate to `/login` | Login form renders | |
| 2.8 | Login with invalid credentials | Error message shown | |
| 2.9 | Login with valid approved fan credentials (`demo.fan@archangels.demo` / `DemoPass123!`) | Redirects to dashboard; user menu shows | |
| 2.10 | Navigate to `/dashboard` while logged in | Dashboard loads; no blank screen | |
| 2.11 | Navigate to `/explore` without logging in | Explore page loads; creators and content cards visible | |
| 2.12 | Explore page shows horizontal scroll strips (Trending, Locked Drops, etc.) | Strips scroll sideways; no overflow bleed | |
| 2.13 | Click a creator card on Explore | Navigates to creator profile page | |

- [ ] 2.1 Homepage loads
- [ ] 2.2 All homepage sections visible
- [ ] 2.3 Request access form appears
- [ ] 2.4 Valid signup submits successfully
- [ ] 2.5 Duplicate email handled
- [ ] 2.6 Empty form validated
- [ ] 2.7 Login page loads
- [ ] 2.8 Invalid login rejected
- [ ] 2.9 Valid login succeeds
- [ ] 2.10 Dashboard loads post-login
- [ ] 2.11 Explore loads unauthenticated
- [ ] 2.12 Horizontal scroll strips work
- [ ] 2.13 Creator card navigation works

---

## 3. Creator Flow

**Date:** ________ | **Tester:** ________

| # | Test | Expected Result | Pass / Fail / Notes |
|---|------|-----------------|---------------------|
| 3.1 | Navigate to `/apply-creator` as an approved fan | Creator application form loads | |
| 3.2 | Submit application with all fields filled | Success message; application saved | |
| 3.3 | Log in as admin → navigate to `/admin/creator-approvals` | New application appears in queue | |
| 3.4 | Admin clicks "Approve" on a creator application | Creator status updates to approved; set-password email sent (check Railway logs) | |
| 3.5 | Admin clicks "Reject" on a creator application | Status updates to rejected; applicant row updated | |
| 3.6 | Log in as a demo creator (`demo.arialuxe@archangels.demo` / `DemoPass123!`) | Redirects to creator dashboard | |
| 3.7 | Creator dashboard shows earnings, content list, stats | All panels populated or show correct empty state | |
| 3.8 | Navigate to `/upload` as creator | Upload form loads | |
| 3.9 | Submit content upload (title, type, access_type, price, URLs) | Success message; content enters `pending_review` | |
| 3.10 | Admin navigates to `/admin/content-approvals` | New submission appears | |
| 3.11 | Admin approves content | Content status = `approved`; visible on Explore | |
| 3.12 | Creator profile page at `/creator/arialuxe` loads | Profile, bio, content grid, tip/subscribe CTAs visible | |

- [ ] 3.1 Creator application form loads
- [ ] 3.2 Application submits
- [ ] 3.3 Admin sees application
- [ ] 3.4 Admin can approve creator
- [ ] 3.5 Admin can reject creator
- [ ] 3.6 Creator login works
- [ ] 3.7 Creator dashboard loads
- [ ] 3.8 Upload form loads
- [ ] 3.9 Content upload submits
- [ ] 3.10 Admin sees content submission
- [ ] 3.11 Admin can approve content
- [ ] 3.12 Creator profile page loads

---

## 4. Content Flow

**Date:** ________ | **Tester:** ________

| # | Test | Expected Result | Pass / Fail / Notes |
|---|------|-----------------|---------------------|
| 4.1 | Navigate to a `locked` content item as unauthenticated user | Lock overlay shown; price displayed; "Request Access to Unlock" CTA shown; `media_url` is NOT revealed | |
| 4.2 | Navigate to a `locked` content item as authenticated but unapproved user | Lock overlay shown; "Your account is pending approval" message shown | |
| 4.3 | Navigate to a `locked` content item as approved fan with NO active subscription | Lock overlay shows full base price; no strikethrough | |
| 4.4 | Navigate to a `locked` content item as approved fan WITH active subscription to that creator | Lock overlay shows discounted price with strikethrough original price | |
| 4.5 | Navigate to a `subscribers` content item as unauthenticated user | Lock overlay shown; "Subscribers only" badge; no media revealed | |
| 4.6 | Navigate to a `subscribers` content item as fan with active subscription | Content unlocks immediately; media shown; no payment required | |
| 4.7 | Navigate to a `free` content item | Content loads immediately; media shown; no paywall | |
| 4.8 | Confirm `media_url` is NOT in the API response for locked/subscriber content before unlock | Network tab: `GET /api/content/:id` response has `media_url: null` | |
| 4.9 | Subscription upsell block on locked content page shows correct text | "Exclusive subscriber posts + discounts on locked drops" — not "full access" or "unlimited" | |

- [ ] 4.1 Locked content shows paywall to unauthenticated user
- [ ] 4.2 Locked content shows pending message to unapproved user
- [ ] 4.3 Locked content shows base price to non-subscriber
- [ ] 4.4 Locked content shows discounted price (with strikethrough) to subscriber
- [ ] 4.5 Subscribers-only content locked to non-subscribers
- [ ] 4.6 Subscribers-only content unlocked for active subscribers (no payment)
- [ ] 4.7 Free content opens without paywall
- [ ] 4.8 `media_url` not leaked in API response
- [ ] 4.9 Subscription upsell text is accurate

---

## 5. Payment Flow

**Date:** ________ | **Tester:** ________

Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC.

| # | Test | Expected Result | Pass / Fail / Notes |
|---|------|-----------------|---------------------|
| 5.1 | Click "Unlock Access · $X.XX" on a locked content page as approved fan | Redirects to Stripe Checkout at correct price | |
| 5.2 | Subscriber discount applied at checkout | Stripe shows discounted price (not base price) if fan has active subscription | |
| 5.3 | Complete payment on Stripe | Redirects back to `/content/:id?payment=success` | |
| 5.4 | Content unlocks after successful payment | "Payment successful — access unlocked" banner shown; media visible | |
| 5.5 | Refresh page after unlock | Content remains unlocked; no re-payment prompted | |
| 5.6 | Attempt to unlock already-unlocked content | Returns `{ already_unlocked: true }`; no second Stripe session created | |
| 5.7 | Cancel payment on Stripe | Redirects to `/content/:id` (no `?payment=success`); paywall still shown | |
| 5.8 | Click "Tip" on creator profile → select amount → submit | Redirects to Stripe Checkout for tip amount | |
| 5.9 | Complete tip payment | Redirects to `/creator/:username?payment=success&type=tip`; success shown | |
| 5.10 | Click "Subscribe" on creator profile | Redirects to Stripe Checkout for monthly subscription | |
| 5.11 | Complete subscription payment | Redirects to `/creator/:username?payment=success&type=subscription`; subscribe button state updates | |
| 5.12 | After subscription: revisit locked content from that creator | Discounted price shown with strikethrough | |
| 5.13 | Check Railway logs after any payment | Webhook log `[webhook] session completed` visible; no errors | |
| 5.14 | Check `transactions` table has a row for the payment | `status = 'completed'`, correct `amount`, `platform_fee`, `net_amount` | |

- [ ] 5.1 Unlock button opens Stripe
- [ ] 5.2 Subscriber discount applied at Stripe checkout
- [ ] 5.3 Post-payment redirect works
- [ ] 5.4 Content unlocks on success
- [ ] 5.5 Unlock persists after refresh
- [ ] 5.6 Double-unlock prevented
- [ ] 5.7 Cancel page works
- [ ] 5.8 Tip button opens Stripe
- [ ] 5.9 Tip success page works
- [ ] 5.10 Subscribe button opens Stripe
- [ ] 5.11 Subscription success works
- [ ] 5.12 Subscription discount visible on locked content after subscribing
- [ ] 5.13 Webhook fires and logs correctly
- [ ] 5.14 Transaction recorded in database

---

## 6. Admin Flow

**Date:** ________ | **Tester:** ________

| # | Test | Expected Result | Pass / Fail / Notes |
|---|------|-----------------|---------------------|
| 6.1 | Log in as admin → navigate to `/admin` | Admin dashboard overview loads; stats populated | |
| 6.2 | Navigate to `/admin/access-requests` | Access request queue loads; pending rows visible | |
| 6.3 | Navigate to `/admin/creator-approvals` | Creator application queue loads | |
| 6.4 | Navigate to `/admin/content-approvals` | Content review queue loads | |
| 6.5 | Approve an access request | Row updates; user receives set-password email (check logs) | |
| 6.6 | Reject an access request | Row updates; no error | |
| 6.7 | Approve a creator application | Creator profile `is_approved = 1`; application_status = `approved` | |
| 6.8 | Approve a content item | Content `status = 'approved'`; visible on Explore | |
| 6.9 | Navigate to `/admin/flagged` | Flagged content/reports load; dismiss/action/escalate buttons visible | |
| 6.10 | Click "Dismiss" on a flagged report | Report status updates; no crash | |
| 6.11 | Navigate to `/admin/transactions` | Transaction ledger loads; rows visible | |
| 6.12 | Admin dashboard chart stats reflect real data | No hardcoded `$144,200` etc.; values match DB | |

- [ ] 6.1 Admin dashboard loads
- [ ] 6.2 Access requests load
- [ ] 6.3 Creator approvals load
- [ ] 6.4 Content approvals load
- [ ] 6.5 Approve access request works
- [ ] 6.6 Reject access request works
- [ ] 6.7 Approve creator works
- [ ] 6.8 Approve content works
- [ ] 6.9 Flagged content loads
- [ ] 6.10 Report dismiss works
- [ ] 6.11 Transactions load
- [ ] 6.12 Dashboard stats are real

---

## 7. Backend / API Checks

**Date:** ________ | **Tester:** ________

Run these directly against the Railway URL or via browser devtools.

| # | Test | Expected Result | Pass / Fail / Notes |
|---|------|-----------------|---------------------|
| 7.1 | `GET /api/creators` | HTTP 200; JSON array with `username`, `display_name`, `subscription_price` fields | |
| 7.2 | `GET /api/content?sort=trending` | HTTP 200; JSON array; each item has `score`, `unlock_count`, `content_revenue` | |
| 7.3 | `GET /api/content?sort=rising` | HTTP 200; valid JSON | |
| 7.4 | `GET /api/content/:id` for a locked item | HTTP 200; `media_url` is null in response | |
| 7.5 | `GET /api/content/:id/my-access` with valid token for unlocked item | `{ unlocked: true, media_url: "..." }` | |
| 7.6 | `GET /api/content/:id/my-access` with valid token for locked item | `{ unlocked: false, media_url: null, is_subscribed: false/true, discounted_price: null/number }` | |
| 7.7 | `POST /api/auth/login` with valid credentials | HTTP 200; `{ token, user }` returned | |
| 7.8 | `GET /api/activity/recent` | HTTP 200; array of up to 10 recent transaction objects | |
| 7.9 | Check Railway logs for `column ... does not exist` errors | No column errors in logs | |
| 7.10 | Check Railway logs for `duplicate key value violates unique constraint users_username_key` | No duplicate username errors | |
| 7.11 | Check Railway logs during content browse (`GET /api/content`) | No SQL errors; query completes | |
| 7.12 | `GET /api/stripe/test` | HTTP 200; Stripe key connectivity confirmed | |

- [ ] 7.1 `/api/creators` returns valid JSON
- [ ] 7.2 `/api/content?sort=trending` returns valid JSON
- [ ] 7.3 `/api/content?sort=rising` returns valid JSON
- [ ] 7.4 `media_url` withheld for locked content
- [ ] 7.5 `/my-access` correct for unlocked content
- [ ] 7.6 `/my-access` correct for locked content (includes `is_subscribed`, `discounted_price`)
- [ ] 7.7 Login endpoint works
- [ ] 7.8 Activity endpoint works
- [ ] 7.9 No missing-column errors in logs
- [ ] 7.10 No duplicate-username errors in logs
- [ ] 7.11 Content browse has no SQL errors
- [ ] 7.12 Stripe connectivity confirmed

---

## 8. Known Issues

Update this section when a test fails and is not immediately fixed. Remove items when fixed.

| # | Description | Affected Test(s) | Priority | Status |
|---|-------------|------------------|----------|--------|
| KI-1 | `media_url` is null for all demo seed content — unlocked content shows nothing in media player | 4.6, 4.7, 5.4 | Medium | Open — demo data only; real uploads unaffected |
| KI-2 | Admin endpoints (`/api/admin/*`) have no JWT auth guard | 6.x | Critical | Open — acceptable for private beta; must fix before public launch |
| KI-3 | `isApproved` reads from stale localStorage — admin approval not reflected until user logs out and back in | 3.4, 6.5 | Medium | Open — no `/api/auth/me` refresh on page load |
| KI-4 | Stripe webhook must be manually registered in Stripe dashboard — if not registered, unlocks never complete after payment | 5.4, 5.5 | Critical | Open — must verify webhook is active before each test run |
| KI-5 | Creator payout requires Stripe Connect Express onboarding — creator share accumulates in platform account if not set up | 5.14 | High | Open — creator dashboard has onboarding flow but not tested end-to-end |

---

*This checklist must be updated after every major change. If you add a new feature, add the corresponding test rows above and update Known Issues as needed.*
