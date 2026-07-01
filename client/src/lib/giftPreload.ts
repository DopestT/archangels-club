/**
 * Gift asset preloading
 * ─────────────────────────────────────────────────────────────────────────────
 * Warms the browser/CDN cache for rich gift assets (rive / webm / hevc / sound)
 * so the first send of a premium gift plays instantly instead of streaming its
 * bytes mid-animation.
 *
 * Uses `<link rel="preload">` hints, injected once, only for assets that exist
 * in the manifest. Emoji-only gifts contribute nothing, so this is a no-op for
 * the current placeholder catalogue and starts doing real work the moment real
 * `.riv`/`.webm` files land — zero code change required.
 *
 * Respects Save-Data / reduced-motion: skips preloading when the user has asked
 * to conserve bandwidth or motion.
 */

import { giftPreloadUrls } from '../components/live/giftManifest';

let done = false;

function asForUrl(url: string): 'fetch' | 'audio' | 'video' {
  if (/\.(mp3|wav|ogg|m4a)$/i.test(url)) return 'audio';
  if (/\.(webm|mp4|mov)$/i.test(url))    return 'video';
  return 'fetch'; // .riv and anything else
}

function saveDataOn(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
}

/**
 * Inject preload hints for all rich gift assets. Idempotent — only runs once
 * per session. Call when a live room mounts.
 */
export function preloadGiftAssets(): void {
  if (done || typeof document === 'undefined') return;
  done = true;

  if (saveDataOn()) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const urls = giftPreloadUrls();
  for (const url of urls) {
    if (document.querySelector(`link[rel="preload"][href="${url}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = asForUrl(url);
    link.href = url;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }
}
