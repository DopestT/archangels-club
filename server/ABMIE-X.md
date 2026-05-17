# ABMIE-X Intelligence System — Reference

Archangels Club Behavioral and Member Intelligence Engine — Extensible

---

## Architecture Overview

ABMIE-X is a **rules-based, data-first** intelligence layer. It reads from real platform
data (transactions, content, messages, subscriptions) and produces:

- Creator coaching cards (actionable, factual)
- Admin intelligence summaries (platform-wide signals)
- Personalized recommendations (with explanations)
- Creator health scores (computed, transparent)

**Design constraint:** No AI call is required for any page to render. AI endpoints are
additive — every surface has a factual fallback.

---

## Database Tables

| Table | Purpose | Notes |
|---|---|---|
| `platform_events` | Append-only behavioral event log | Has `idempotency_key` for deduplication |
| `engagement_signals` | Per-(user, creator) affinity rows | Weighted by signal type |
| `creator_health_scores` | Computed health scores per creator | Refreshed on-demand or nightly |
| `creator_daily_stats` | Per-creator per-date aggregates | Upserted on fulfillment + nightly |
| `platform_daily_stats` | Platform-wide daily aggregates | For admin Pulse view |

---

## Event Types

All events are logged via `POST /api/events` or internally via `logEvent()`.

### Client-logged events (from browser)

| event_type | When to fire | entity_type | entity_id |
|---|---|---|---|
| `view_creator` | User visits a creator profile | `creator` | creator_profile_id |
| `view_content` | User opens a content item | `content` | content_id |
| `search` | User submits a search | — | — |
| `save_content` | User bookmarks content | `content` | content_id |
| `unsave_content` | User removes bookmark | `content` | content_id |
| `page_view` | Generic page view | `page` | route path |

### Server-logged events (from fulfillment)

| event_type | When fired | Source |
|---|---|---|
| `unlock_content` | After Stripe checkout fulfills a content unlock | `fulfillment.ts` |
| `subscribe_creator` | After Stripe checkout fulfills a subscription | `fulfillment.ts` |
| `send_tip` | After Stripe checkout fulfills a tip | `fulfillment.ts` |
| `login` | After successful JWT issuance | `auth.ts` (optional) |
| `signup` | After user creation | `auth.ts` (optional) |
| `publish_content` | After content approved | `content.ts` (optional) |
| `submit_custom_request` | After custom request created | `custom_requests route` |
| `send_message` | After message sent | `messages route` |

### Idempotency

Send a client-generated UUID as `idempotency_key` with each event.
Retries with the same key are silently dropped (no duplicate rows).

```json
{
  "event_type": "view_creator",
  "entity_type": "creator",
  "entity_id": "cp_abc123",
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Fail safety

- `logEvent()` and `recordSignal()` catch all errors internally
- Failures are logged to `console.error` with structured fields:
  `[events] logEvent failed — type=X entity=Y/Z error=<message>`
- Neither function can crash its caller (fire-and-forget pattern)
- Fulfillment calls use `.catch(() => {})` as an additional guard

---

## Engagement Signals

`recordSignal(userId, creatorProfileId, signalType)` appends a weighted row to
`engagement_signals`. Used for affinity-based recommendations.

| signal_type | weight | Trigger |
|---|---|---|
| `view` | 0.5 | Creator profile viewed |
| `save` | 1.5 | Content bookmarked |
| `message` | 2.0 | Message sent to creator |
| `unlock` | 3.0 | Content purchased |
| `tip` | 4.0 | Tip sent |
| `custom_request` | 4.0 | Custom request submitted |
| `subscribe` | 5.0 | Subscription activated |

Affinity score = sum of signal weights in the last 60 days.

---

## Creator Health Scoring

**Route:** `GET /api/pulse/my-health` (creator), `GET /api/pulse/creators` (admin)

**Recompute:** `POST /api/pulse/creators/:profileId/refresh` (admin)

Auto-refreshes when stale (>1 hour old) on `my-health` reads.

### Component scores (each 0–100)

| Component | Weight | Formula |
|---|---|---|
| Posting | 30% | `min(100, (approved_posts_30d / 8) * 100)` |
| Engagement | 30% | `min(100, (signal_weight_sum_30d / 50) * 100)` |
| Revenue | 25% | Ratio of 30-day revenue vs 3-month monthly average |
| Retention | 15% | `(active_subs / total_subs) * 100` |

**Overall** = weighted sum of the four components.

**Posting target:** 8+ approved posts per 30 days = score 100.
**Engagement target:** 50+ weighted signal points per 30 days = score 100.
**Revenue:** Score 50 = flat vs average; 100 = 2× average; 0 = zero revenue.
**Retention:** Score 100 = all subscribers still active; 0 = all churned.

**Streak days:** Consecutive calendar days (back from today) with at least one approved post.

---

## Recommendation Endpoints

### `GET /api/recommendations/creators`
**Auth:** Required  
**Returns:** Personalized creator picks for the authenticated user, ranked by:
1. Engagement affinity (60-day signal weight sum)
2. Creator health overall score
3. Active subscriber count

Excludes creators the user already subscribes to.

**Each result includes:**
```json
{
  "id": "...",
  "username": "...",
  "reason": "You've engaged with their content before",
  "signal": "4.5 affinity score from recent interactions",
  "action": "View profile",
  "confidence": 0.85
}
```

### `GET /api/recommendations/trending`
**Auth:** Optional (anonymous-safe)  
**Returns:** Content with the most unlocks in the last 7 days.

### `GET /api/recommendations/similar/:profileId`
**Auth:** Optional  
**Returns:** Creators sharing tags with the given creator profile.

### `GET /api/recommendations/member`
**Auth:** Required  
**Returns:** All 7 recommendation sections for the authenticated member. Each section
contains up to 6 creators with `reason`, `signal`, `action`, `confidence`, `metric_label`,
`metric_value`. Empty sections are omitted. Results are cached (5 min global, 10 min
per-user). Safe to call on every dashboard load.

```json
{
  "sections": [
    {
      "type": "trending",
      "label": "Trending This Week",
      "description": "...",
      "creators": [{ "id": "...", "username": "...", "reason": "...", "confidence": 0.71 }]
    }
  ]
}
```

**Section types (priority order):**
1. `subscription_opportunity` — user unlocked 2+ from this creator but isn't subscribed
2. `trending` — highest 7-day weighted activity (subs×5 + unlocks×2 + views×0.3)
3. `similar_to_vault` — tag overlap with creators the user has unlocked from
4. `rising_fast` — velocity ratio ≥1.3× (7-day pace vs 30-day weekly average)
5. `most_collected` — most content unlocks in 30 days
6. `recently_active` — posted approved content in last 14 days
7. `custom_requests_open` — accepting requests with <10 pending

### Confidence levels

| Range | Interpretation |
|---|---|
| 0.85–1.0 | Strong signal — multiple recent interactions |
| 0.65–0.84 | Good signal — some behavioral evidence |
| 0.50–0.64 | Weak signal — primarily popularity or tag match |
| < 0.50 | Not currently returned |

---

## Creator Intelligence Endpoints

### `GET /api/intelligence/my-insights`
**Auth:** Creator  
**Returns:** Array of coaching cards sorted by priority then confidence.

### `GET /api/intelligence/creator/:profileId`
**Auth:** Admin  
**Returns:** Coaching cards for any creator (admin support view).

### `GET /api/intelligence/admin-summary`
**Auth:** Admin  
**Returns:** Full intelligence report with 6 sections:
- `creators_needing_support` — health < 25, repeated rejections, blocked payouts, inactive
- `high_potential_low_conversion` — high views, low unlock rate
- `trending_creators` — ranked by 7-day subs + unlocks
- `inactive_creators` — no approved content in 30+ days
- `moderation_pressure` — pending content review + open reports
- `revenue_signals` — fulfillment `needs_review` count + blocked payout creators

### `GET /api/intelligence/creator/:profileId`
**Auth:** Admin  
**Returns:** Same coaching cards as `my-insights` but for any creator (admin support view).

---

## Pulse Data Layer

### `GET /api/pulse/platform`
**Auth:** Admin  
Live platform aggregates:

```json
{
  "users": { "total": 0, "approved": 0, "creators": 0, "new_7d": 0 },
  "revenue": { "total_cents": 0, "last_30d_cents": 0, "last_7d_cents": 0 },
  "content": { "total": 0, "approved": 0, "pending_review": 0 },
  "subscriptions": { "active": 0, "new_30d": 0 },
  "events": { "count_7d": 0 }
}
```

### `GET /api/pulse/creators`
**Auth:** Admin  
All creator health scores with user info, ordered by overall_score DESC.

### `GET /api/pulse/my-stats`
**Auth:** Creator  
30-day daily breakdown: views, unlocks, new_subscribers, revenue_cents, messages_received.

---

## Ethics Rules

These are enforced by code structure, not convention:

1. **No fake metrics** — all numbers come from live DB queries on real data
2. **No fake urgency** — insight text does not invent scarcity or time pressure
3. **No hidden pricing** — no suggestion alters pricing without creator action
4. **No auto-sent messages** — insight cards produce no automated outreach
5. **No manipulative pressure** — body text is observational, not coercive
6. **Minimum signal thresholds** — rules only fire when enough data exists to be meaningful

---

## Safe Testing Checklist (before new ABMIE-X phases)

### Stripe / Payments (DO NOT break)
- [ ] Create a Stripe test checkout for a content unlock → fulfillment completes → `content_unlocks` row exists
- [ ] Create a Stripe test checkout for a subscription → `subscriptions` row active
- [ ] Create a Stripe test checkout for a tip → `transactions` row completed
- [ ] Verify `fulfillment_records` row is `fulfilled` for each of the above
- [ ] Verify engagement signal rows were created (check `engagement_signals` table)
- [ ] Verify `platform_events` rows were created (check `platform_events` table)
- [ ] Confirm the checkout page still loads without error
- [ ] Confirm buyer does NOT see "Verification Pending" or auth errors during checkout

### Auth / Routing (DO NOT break)
- [ ] Login with existing approved fan account → lands on `/dashboard`
- [ ] Login with approved creator → lands on `/creator` (not `/apply-creator`)
- [ ] Attempt `/creator` route as non-creator → redirected to `/dashboard`
- [ ] Attempt `/admin` route as non-admin → redirected to `/dashboard`
- [ ] JWT refresh via `refreshUser()` still works after login

### Creator Dashboard
- [ ] Creator can view content list
- [ ] Creator can upload a new content item
- [ ] Creator can view their earnings
- [ ] `GET /api/pulse/my-health` returns score (may be 0 if no data, that is correct)
- [ ] `GET /api/intelligence/my-insights` returns array (may be empty on new accounts)
- [ ] `GET /api/intelligence/creator/:profileId` (admin) returns insights for that creator

### Admin Dashboard
- [ ] `GET /api/pulse/platform` returns platform stats object
- [ ] `GET /api/pulse/creators` returns array (may be empty if no health scores computed)
- [ ] `GET /api/intelligence/admin-summary` returns all 6 sections
- [ ] Creator approval flow still works (admin approves → creator can access studio)

### Events
- [ ] `POST /api/events` with valid `event_type` → returns `{ ok: true }`
- [ ] `POST /api/events` without auth token → still returns `{ ok: true }` (anonymous allowed)
- [ ] `POST /api/events` with same `idempotency_key` twice → only one row in `platform_events`
- [ ] `POST /api/events` with invalid `event_type` → returns 400 error
- [ ] Check Railway logs after event POST — no error output for valid events

### Recommendations
- [ ] `GET /api/recommendations/trending` without auth → returns content array
- [ ] `GET /api/recommendations/creators` with auth → returns creator array with `reason`, `signal`, `action`, `confidence`
- [ ] `GET /api/recommendations/member` with auth → returns `{ sections: [...] }` with at least one section if creators exist
- [ ] Calling `GET /api/recommendations/member` twice → second call is faster (cache hit)
- [ ] Member dashboard loads without waiting for recommendations (SQL recs appear first, enriched sections replace them)
- [ ] Recommendations page load does NOT add measurable latency to dashboard (queries are read-only)

### Performance check
- [ ] Dashboard page load time before and after ABMIE-X routes ≤ 200ms added latency
- [ ] Intelligence routes use `Promise.all()` for parallel queries — verify in code, not just runtime
- [ ] No ABMIE-X query runs inside the Stripe webhook handler synchronously

### Regression check
- [ ] Vault content access works for subscribers
- [ ] Message thread loads correctly
- [ ] Notification center still shows notifications
- [ ] Content moderation queue (admin) still shows pending items

---

## Adding New ABMIE-X Phases Safely

Before starting:
1. Run the full testing checklist above
2. Read `services/fulfillment.ts` — understand what fires atomically vs async
3. Read `db/migrate.ts` — understand all `IF NOT EXISTS` patterns
4. Never add synchronous DB writes inside the Stripe webhook critical path
5. New intelligence rules: add to `services/intelligence.ts` or `services/creatorInsights.ts`
6. New event types: add to `ALLOWED_EVENTS` set in `routes/events.ts` AND to `EventType` in `services/events.ts`
7. New DB tables: append to `migrate.ts` using `IF NOT EXISTS` — never alter existing `CREATE TABLE` blocks

---

---

## Known Issues Fixed (Phase 5)

- `getTrendingCreators` used `HAVING` without `GROUP BY`, which PostgreSQL treats as a single-group
  aggregate and rejects bare column selects. Fixed by wrapping in a derived subquery with `WHERE`.

*Last updated: 2026-05-17*
