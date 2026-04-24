# Archangels Club

Members-only creator platform. React/Vite frontend + Express/Node backend on PostgreSQL (Neon).

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| Backend | Express, TypeScript, Node 20+ |
| Database | PostgreSQL via [Neon](https://neon.tech) (serverless) |
| Email | [Resend](https://resend.com) |
| SMS | [Twilio](https://twilio.com) |
| Frontend hosting | [Vercel](https://vercel.com) |
| Backend hosting | [Railway](https://railway.app) or [Render](https://render.com) |

---

## Local Development

### Prerequisites
- Node 20+
- A Neon account (free tier works)

### 1. Clone and install

```bash
git clone https://github.com/yourusername/archangels-club.git
cd archangels-club

# Install server deps
cd server && npm install

# Install client deps
cd ../client && npm install
```

### 2. Set up Neon PostgreSQL

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new **Project** (e.g. `archangels-club`)
3. In the project dashboard, go to **Connection Details**
4. Select **Pooled connection** and copy the connection string
5. It looks like: `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`

### 3. Configure environment

```bash
# In /server, copy and fill in your values
cp ../.env.example server/.env
```

Required variables:
```
DATABASE_URL=postgresql://...  # Neon pooled connection string
JWT_SECRET=<random 32+ char string>
NODE_ENV=development
```

### 4. Run migrations

Migrations run automatically when the server starts. No separate step needed.

### 5. Start dev servers

```bash
# Terminal 1 — backend (port 4000)
cd server && npm run dev

# Terminal 2 — frontend (port 3000)
cd client && npm run dev
```

---

## Database Health Check

```
GET /api/health/db
```

Returns `{ "ok": true, "database": "connected" }` when Neon is reachable.

---

## Production Deployment

### Deploy backend to Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select the `archangels-club` repo, set **Root Directory** to `server`
3. Railway auto-detects Node. Set these environment variables:
   ```
   NODE_ENV=production
   DATABASE_URL=<Neon pooled connection string>
   JWT_SECRET=<strong random secret>
   CLIENT_URL=https://your-vercel-app.vercel.app
   RESEND_API_KEY=re_...
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_FROM_NUMBER=+1...
   PORT=4000
   ```
4. Deploy — migrations run on startup automatically
5. Copy the Railway public URL (e.g. `https://archangels-api.up.railway.app`)

### Deploy frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Set **Root Directory** to `client`
3. Build settings (Vercel auto-detects Vite):
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add environment variable:
   ```
   VITE_API_URL=https://your-railway-url.up.railway.app
   ```
5. Deploy

### Verify

After both are deployed, visit:
```
https://your-railway-url.up.railway.app/api/health/db
```
Should return `{ "ok": true, "database": "connected" }`.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** (production) | Neon pooled PostgreSQL connection string |
| `NODE_ENV` | Yes | `development` or `production` |
| `JWT_SECRET` | Yes | Random string for signing JWTs (min 32 chars) |
| `PORT` | No | Server port (default: 4000) |
| `CLIENT_URL` | No | Allowed CORS origin for frontend |
| `RESEND_API_KEY` | No | Resend email API key (emails log to console if missing) |
| `TWILIO_ACCOUNT_SID` | No | Twilio account SID (SMS logs to console if missing) |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_FROM_NUMBER` | No | Twilio from phone number |
| `VITE_API_URL` | No (client) | Backend URL for production (empty = use Vite proxy) |
