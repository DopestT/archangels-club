# Archangels Club — Deployment Reference

## Architecture

| Layer    | Service  | URL                                              |
|----------|----------|--------------------------------------------------|
| Frontend | Vercel   | https://www.archangelsclub.com                   |
| Backend  | Railway  | https://archangels-club-production.up.railway.app |
| Database | Railway  | PostgreSQL (internal — `postgres.railway.internal`) |

**These deploy independently.** Pushing to GitHub does NOT automatically deploy either.
Every deployment is a manual, explicit action.

---

## Deploying the Frontend (Vercel)

The frontend must be built and deployed from the `client/` directory.

```bash
# From repo root:
./deploy-frontend.sh

# Or manually:
cd client
npm run build
npx vercel --prod
```

After deploy, verify the new build is live:
```bash
curl -s https://www.archangelsclub.com/ | grep -o 'MessagesPage-[^"]*\.js'
```
The chunk filename hash changes with every content change — a different hash = new build live.

Also check the browser console on https://www.archangelsclub.com — you will see:
```
[Archangels Club] build <git-sha> — <timestamp>
```

---

## Deploying the Backend (Railway)

Run from the **repo root** (not from inside `server/`):

```bash
# From repo root:
railway up --service archangels-club
```

Verify the backend updated:
```bash
curl -s https://www.archangelsclub.com/api/health
# Returns: {"status":"ok","platform":"Archangels Club API","build":"v0.1.1"}
```

To bump the visible build version, edit `server/package.json` → `"version"` field
and update the `build` string in `server/src/index.ts` → `/api/health` response.

---

## Required Environment Variables

### Backend (set in Railway dashboard or via CLI)

| Variable               | Description                                      |
|------------------------|--------------------------------------------------|
| `DATABASE_URL`         | Internal PostgreSQL URL (auto-set by Railway)    |
| `JWT_SECRET`           | Secret for signing JWT tokens                    |
| `STRIPE_SECRET_KEY`    | Stripe secret key (`sk_live_...`)                |
| `STRIPE_WEBHOOK_SECRET`| Stripe webhook signing secret (`whsec_...`)      |
| `RESEND_API_KEY`       | Resend email API key                             |
| `RESEND_AUDIENCE_ID`   | Resend audience ID for contact sync              |
| `CLIENT_URL`           | Frontend URL (`https://www.archangelsclub.com`)  |
| `NODE_ENV`             | Set to `production`                              |
| `PORT`                 | Server port (Railway sets this automatically)    |

Check current Railway variables:
```bash
railway variables --service archangels-club
```

### Frontend (Vercel)

No environment variables required. API calls use relative `/api/*` paths, which
Vercel proxies to Railway via the rewrite rule in `client/vercel.json`.

Optional override:
| Variable       | Description                        |
|----------------|------------------------------------|
| `VITE_API_URL` | Override API base (leave unset for production) |

---

## Verifying a Deployment Took Effect

### Frontend
```bash
# Check which MessagesPage chunk is live (hash changes when code changes)
curl -s https://www.archangelsclub.com/assets/index-*.js 2>/dev/null | \
  grep -o 'MessagesPage-[^"]*' | head -1

# Or open browser console — look for:
# [Archangels Club] build abc1234 — 2026-05-10T...
```

### Backend
```bash
curl -s https://www.archangelsclub.com/api/health
curl -s https://www.archangelsclub.com/api/health/db
```

---

## Force Cache Busting

Vercel serves assets with long-cache headers (`Cache-Control: public, max-age=31536000`).
Asset filenames include a content hash (e.g. `MessagesPage-efiSg-mW.js`) — any code change
produces a new hash, which bypasses CDN cache automatically.

If the browser is caching the old entry point:
- Hard refresh: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows)
- Or open in Incognito/Private window

Railway deployments take effect immediately — no CDN caching on the API layer.

---

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Frontend change not showing | Vercel not deployed | Run `./deploy-frontend.sh` |
| Backend change not showing | Railway not deployed | Run `railway up --service archangels-club` from repo root |
| Railway deploy fails — "directory does not exist" | Running `railway up` from inside `server/` | Always run from repo root |
| Stripe webhook rejected | `STRIPE_WEBHOOK_SECRET` not set in Railway | `railway variables set STRIPE_WEBHOOK_SECRET=whsec_...` |
| Emails not sending | `RESEND_API_KEY` invalid or rotated | Update key in Railway variables |
| DB unreachable locally | Using internal `postgres.railway.internal` URL | Use `DATABASE_PUBLIC_URL` for local scripts |
