import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';

/**
 * GiftAnimationManager — renders gift animations across multiple layered LANES
 * so several gifts can play at once. Deliberately does NOT use a single
 * "current gift" state: gifts are pushed imperatively and each lives
 * independently until its own timer expires.
 *
 * Agora handles only video/audio. Gifts are an app-layer overlay driven by
 * room events (tips/gifts), pushed in via the imperative `push()` handle.
 */

export type GiftTier = 'standard' | 'premium' | 'rare' | 'legendary' | 'inner_circle';

export interface IncomingGift {
  /** Optional stable id; auto-generated if omitted. */
  id?: string;
  /** Sender display name (display names only — never real names). */
  name: string;
  /** Optional gift label, e.g. "sent a gift" or a gift name. */
  giftLabel?: string;
  /** Dollar value in cents (drives tier when `tier` is not supplied). */
  amountCents?: number;
  /** Explicit rarity tier; otherwise derived from amountCents. */
  tier?: GiftTier;
}

export interface GiftAnimationHandle {
  push: (gift: IncomingGift) => void;
}

interface ActiveGift extends Required<Pick<IncomingGift, 'name'>> {
  id: string;
  lane: number;
  giftLabel?: string;
  amountCents: number;
  tier: GiftTier;
}

const LANE_COUNT = 3;

// Per-tier on-screen duration (ms). Higher tiers linger longer.
const TIER_MS: Record<GiftTier, number> = {
  standard: 3200,
  premium: 3800,
  rare: 4400,
  legendary: 5200,
  inner_circle: 6000,
};

/** Derive a rarity tier from the gift's dollar value when not explicitly set. */
function tierForAmount(cents: number): GiftTier {
  if (cents >= 10000) return 'inner_circle'; // $100+
  if (cents >= 5000) return 'legendary';      // $50+
  if (cents >= 2000) return 'rare';           // $20+
  if (cents >= 500) return 'premium';         // $5+
  return 'standard';
}

function tierStyle(tier: GiftTier): { glow: string; ring: string; emoji: string } {
  switch (tier) {
    case 'inner_circle':
      return { glow: '0 10px 60px rgba(212,175,55,0.45)', ring: 'rgba(212,175,55,0.9)', emoji: '👑' };
    case 'legendary':
      return { glow: '0 10px 50px rgba(212,175,55,0.35)', ring: 'rgba(212,175,55,0.7)', emoji: '🌟' };
    case 'rare':
      return { glow: '0 8px 40px rgba(212,175,55,0.28)', ring: 'rgba(212,175,55,0.5)', emoji: '✨' };
    case 'premium':
      return { glow: '0 8px 32px rgba(212,175,55,0.2)', ring: 'rgba(212,175,55,0.4)', emoji: '💛' };
    default:
      return { glow: '0 6px 24px rgba(212,175,55,0.15)', ring: 'rgba(212,175,55,0.3)', emoji: '✦' };
  }
}

const GiftAnimationManager = forwardRef<GiftAnimationHandle, { maxVisible?: number }>(
  ({ maxVisible = 9 }, ref) => {
    const [active, setActive] = useState<ActiveGift[]>([]);
    const laneCursor = useRef(0);
    const counter = useRef(0);

    const remove = useCallback((id: string) => {
      setActive((cur) => cur.filter((g) => g.id !== id));
    }, []);

    const push = useCallback((gift: IncomingGift) => {
      const id = gift.id ?? `gift-${Date.now()}-${counter.current++}`;
      const lane = laneCursor.current % LANE_COUNT;
      laneCursor.current += 1;
      const amountCents = gift.amountCents ?? 0;
      const tier = gift.tier ?? tierForAmount(amountCents);

      const item: ActiveGift = { id, lane, name: gift.name, giftLabel: gift.giftLabel, amountCents, tier };

      // Cap the number of simultaneous animations; drop the oldest if over.
      setActive((cur) => {
        const next = [...cur, item];
        return next.length > maxVisible ? next.slice(next.length - maxVisible) : next;
      });

      window.setTimeout(() => remove(id), TIER_MS[tier]);
    }, [maxVisible, remove]);

    useImperativeHandle(ref, () => ({ push }), [push]);

    return (
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: 60 }} aria-live="polite">
        {active.map((g) => {
          const s = tierStyle(g.tier);
          // Lane positions the gift horizontally; multiple lanes layer side by side.
          const leftPct = ((g.lane + 1) / (LANE_COUNT + 1)) * 100;
          return (
            <div
              key={g.id}
              className="absolute flex justify-center"
              style={{
                left: `${leftPct}%`,
                top: 16,
                transform: 'translateX(-50%)',
                animation: 'giftDrop 4.2s ease forwards',
              }}
            >
              <div
                className="flex items-center gap-3 px-5 py-2.5 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(18,12,2,0.97) 0%, rgba(30,20,4,0.97) 100%)',
                  border: `1px solid ${s.ring}`,
                  boxShadow: s.glow,
                  backdropFilter: 'blur(12px)',
                }}
              >
                <span style={{ fontSize: 20 }}>{s.emoji}</span>
                <span className="text-sm font-semibold text-white">{g.name}</span>
                <span className="text-xs text-zinc-400">
                  {g.amountCents > 0
                    ? (g.giftLabel ?? `just gifted $${(g.amountCents / 100).toFixed(2)}`)
                    : (g.giftLabel ?? 'sent a gift — processing…')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
);

GiftAnimationManager.displayName = 'GiftAnimationManager';
export default GiftAnimationManager;
