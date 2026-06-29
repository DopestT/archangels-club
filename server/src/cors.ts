/**
 * Centralized CORS origin allow-listing.
 *
 * Shared by the Express app (index.ts) and Socket.IO (socket.ts) so the two can
 * never drift apart.
 *
 * Allowed origins:
 *  - Production domains (archangelsclub.com, www.archangelsclub.com)
 *  - Origins from the CLIENT_ORIGINS or ALLOWED_ORIGINS env var (comma-separated)
 *  - Localhost dev URLs (non-production only)
 *  - Vercel preview deployments of this project's `client` app:
 *      https://client-*.vercel.app
 *
 * Deliberately NOT allowed: blanket `*.vercel.app`, `origin: true`, or disabling
 * CORS. The allow-list stays explicit.
 */

const PRODUCTION_ORIGINS = [
  'https://archangelsclub.com',
  'https://www.archangelsclub.com',
];

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
];

// Safe fallback for the current Vercel preview origin, used when the env var is
// unset. The regex below also matches future preview hashes, so this is just a
// belt-and-suspenders default — not the primary mechanism.
const FALLBACK_PREVIEW_ORIGINS = [
  'https://client-2dcfip89t-dopestts-projects.vercel.app',
];

// Vercel preview deployments of THIS project's `client` app. Matches e.g.
//   https://client-2dcfip89t-dopestts-projects.vercel.app
//   https://client-git-<branch>-dopestts-projects.vercel.app
// Scoped to the `client-` prefix — we do NOT open up all of *.vercel.app.
const VERCEL_CLIENT_PREVIEW_RE = /^https:\/\/client-[a-z0-9-]+\.vercel\.app$/i;

/** Origins supplied via env (CLIENT_ORIGINS preferred, ALLOWED_ORIGINS fallback). */
function envOrigins(): string[] {
  const raw = process.env.CLIENT_ORIGINS ?? process.env.ALLOWED_ORIGINS ?? '';
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/** The full static (non-regex) allow-list. Exposed for logging/diagnostics. */
export function staticAllowedOrigins(): string[] {
  return [
    ...PRODUCTION_ORIGINS,
    ...envOrigins(),
    ...FALLBACK_PREVIEW_ORIGINS,
    ...(process.env.NODE_ENV !== 'production' ? DEV_ORIGINS : []),
  ];
}

/** Whether a given request Origin header is allowed. */
export function isAllowedOrigin(origin: string | undefined): boolean {
  // No Origin header → non-browser client (curl, health checks, server-to-server).
  if (!origin) return true;
  if (staticAllowedOrigins().includes(origin)) return true;
  if (VERCEL_CLIENT_PREVIEW_RE.test(origin)) return true;
  return false;
}

/** cors() options object shared by Express and Socket.IO. */
export const corsOptions = {
  origin: (origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => {
    if (isAllowedOrigin(origin)) return cb(null, true);
    cb(new Error(`CORS: origin not allowed — ${origin}`));
  },
  credentials: true,
};
