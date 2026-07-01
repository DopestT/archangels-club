/**
 * Audio unlock
 * ─────────────────────────────────────────────────────────────────────────────
 * Browsers block audio playback until the user has interacted with the page.
 * Live-gift sounds fire from a socket event, not a click, so without priming
 * the very first premium gift would animate silently.
 *
 * This module resumes a shared AudioContext on the first real user gesture
 * (pointer/key/touch) — e.g. the live room "Entry Ritual" tap — after which
 * gift sounds are allowed to play for the rest of the session.
 *
 * It also exposes `playGiftSound()` so callers share one unlocked context
 * instead of each spawning their own (Safari caps concurrent contexts).
 */

let ctx: AudioContext | null = null;
let unlocked = false;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

function tryResume() {
  const c = getContext();
  if (!c) return;
  if (c.state === 'suspended') {
    c.resume().then(() => { unlocked = true; }).catch(() => {});
  } else {
    unlocked = true;
  }
}

/**
 * Attach one-time gesture listeners that unlock audio on first interaction.
 * Safe to call multiple times — listeners are only installed once. Call from
 * app entry (main.tsx).
 */
export function installAudioUnlock(): void {
  if (typeof window === 'undefined' || unlocked) return;

  const handler = () => {
    tryResume();
    if (unlocked) removeListeners();
  };
  const removeListeners = () => {
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
    window.removeEventListener('touchstart', handler);
  };

  window.addEventListener('pointerdown', handler, { passive: true });
  window.addEventListener('keydown', handler, { passive: true });
  window.addEventListener('touchstart', handler, { passive: true });
}

/** True once the shared AudioContext has been resumed by a user gesture. */
export function isAudioUnlocked(): boolean {
  return unlocked;
}

/**
 * Play a gift sound through the shared unlocked context. No-op (never throws)
 * if audio is still locked or the asset can't load, so callers don't need to
 * guard. Returns a promise that resolves whether or not sound actually played.
 */
export async function playGiftSound(src: string, volume = 0.7): Promise<void> {
  if (!unlocked || !src) return;
  try {
    const audio = new Audio(src);
    audio.volume = Math.max(0, Math.min(1, volume));
    await audio.play();
  } catch {
    // Autoplay still blocked or asset missing — silently ignore.
  }
}
