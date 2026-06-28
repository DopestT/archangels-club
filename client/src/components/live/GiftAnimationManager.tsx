import React, {
  useState, useEffect, useCallback, useRef,
  useImperativeHandle, forwardRef, useMemo,
} from 'react';

// ── Public types ──────────────────────────────────────────────────────────────

export interface GiftEvent {
  id: string;
  giftId: string;
  giftName: string;
  goldCost: number;
  senderId: string;
  senderName: string;
  privacy: 'public' | 'private' | 'ghost';
  isAdminTest?: boolean;
}

export interface GiftAnimationHandle {
  emit: (event: GiftEvent) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MICRO_MAX      = 12;
const FEATURE_MAX    = 2;
const MICRO_MS       = 3800;
const FEATURE_MS     = 5400;
const FULLSCREEN_MS  = 7200;
const COMBO_RESET_MS = 5000;

const GIFT_EMOJI: Record<string, string> = {
  gold_rain:        '💛',
  halo_drop:        '✨',
  wings_open:       '🪽',
  crown_signal:     '👑',
  vault_key:        '🗝️',
  private_tribute:  '⭐',
  room_blessing:    '🌟',
  after_hours:      '🌙',
  private_encore:   '🎭',
  vault_drop:       '💎',
  creator_blessing: '🔮',
};

// Deterministic particles — computed once, no Math.random() per render
const GOLD_PARTICLES = [
  { id: 0,  x: 8,  delay: 0.00, size: 4, dur: 2.5 },
  { id: 1,  x: 15, delay: 0.30, size: 3, dur: 3.0 },
  { id: 2,  x: 22, delay: 0.70, size: 5, dur: 2.8 },
  { id: 3,  x: 31, delay: 1.10, size: 3, dur: 3.2 },
  { id: 4,  x: 38, delay: 0.50, size: 4, dur: 2.6 },
  { id: 5,  x: 45, delay: 0.90, size: 6, dur: 3.4 },
  { id: 6,  x: 52, delay: 1.40, size: 3, dur: 2.9 },
  { id: 7,  x: 61, delay: 0.20, size: 4, dur: 2.7 },
  { id: 8,  x: 68, delay: 0.80, size: 3, dur: 3.1 },
  { id: 9,  x: 75, delay: 1.20, size: 5, dur: 2.4 },
  { id: 10, x: 82, delay: 0.40, size: 4, dur: 3.3 },
  { id: 11, x: 91, delay: 0.60, size: 3, dur: 2.8 },
  { id: 12, x: 5,  delay: 1.00, size: 6, dur: 3.0 },
  { id: 13, x: 18, delay: 0.15, size: 4, dur: 2.5 },
  { id: 14, x: 28, delay: 0.55, size: 3, dur: 3.2 },
  { id: 15, x: 42, delay: 1.30, size: 5, dur: 2.7 },
  { id: 16, x: 55, delay: 0.45, size: 4, dur: 3.0 },
  { id: 17, x: 65, delay: 0.75, size: 3, dur: 2.8 },
  { id: 18, x: 78, delay: 1.15, size: 4, dur: 3.1 },
  { id: 19, x: 88, delay: 0.35, size: 5, dur: 2.6 },
];

// Deterministic micro x-offsets — cycle through these instead of Math.random()
const MICRO_X_POOL = [12, 24, 8, 36, 18, 42, 6, 30, 22, 40, 14, 28];

// ── Internal types ─────────────────────────────────────────────────────────────

interface ActiveMicro {
  id: string;
  emoji: string;
  giftName: string;
  senderName: string;
  x: number;       // % from right edge (5–45)
  expiresAt: number;
}

interface ActiveFeature {
  id: string;
  emoji: string;
  giftName: string;
  goldCost: number;
  senderName: string;
  expiresAt: number;
}

interface ActiveFullscreen {
  id: string;
  emoji: string;
  giftName: string;
  goldCost: number;
  senderName: string;
  isAdminTest: boolean;
  exiting: boolean;
}

interface ComboState {
  giftId: string;
  giftName: string;
  emoji: string;
  senderName: string;
  count: number;
  lastAt: number;
  pulsing: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function laneFor(goldCost: number): 'micro' | 'feature' | 'fullscreen' {
  if (goldCost >= 10000) return 'fullscreen';
  if (goldCost >= 500)   return 'feature';
  return 'micro';
}

function resolveDisplayName(event: GiftEvent): string {
  if (event.privacy === 'ghost')   return 'Anonymous';
  if (event.privacy === 'private') return 'Private Patron';
  return event.senderName || 'Member';
}

function formatGold(n: number): string {
  if (n >= 1000) return `${(n / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`;
  return n.toLocaleString();
}

// ── Main component ─────────────────────────────────────────────────────────────

const GiftAnimationManager = forwardRef<GiftAnimationHandle, Record<never, never>>(
  function GiftAnimationManager(_props, ref) {
    const [microGifts,      setMicroGifts]      = useState<ActiveMicro[]>([]);
    const [featureGifts,    setFeatureGifts]    = useState<ActiveFeature[]>([]);
    const [fullscreenGift,  setFullscreenGift]  = useState<ActiveFullscreen | null>(null);
    const [fullscreenQueue, setFullscreenQueue] = useState<Omit<ActiveFullscreen, 'exiting'>[]>([]);
    const [combo,           setCombo]           = useState<ComboState | null>(null);

    const comboTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
    const microXIndexRef    = useRef(0);

    // ── Drain fullscreen queue when slot is free
    useEffect(() => {
      if (!fullscreenGift && fullscreenQueue.length > 0) {
        const [next, ...rest] = fullscreenQueue;
        setFullscreenQueue(rest);
        setFullscreenGift({ ...next, exiting: false });
      }
    }, [fullscreenGift, fullscreenQueue]);

    // ── Schedule fullscreen exit
    useEffect(() => {
      if (!fullscreenGift || fullscreenGift.exiting) return;
      const t = setTimeout(() => {
        setFullscreenGift(prev => prev ? { ...prev, exiting: true } : null);
        setTimeout(() => setFullscreenGift(null), 600);
      }, FULLSCREEN_MS);
      return () => clearTimeout(t);
    }, [fullscreenGift?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Clear expired micro/feature gifts every 500ms
    useEffect(() => {
      const iv = setInterval(() => {
        const now = Date.now();
        setMicroGifts(prev   => prev.filter(g => g.expiresAt > now));
        setFeatureGifts(prev => prev.filter(g => g.expiresAt > now));
      }, 500);
      return () => clearInterval(iv);
    }, []);

    // ── Clear combo pulsing flag after animation
    useEffect(() => {
      if (!combo?.pulsing) return;
      const t = setTimeout(() => setCombo(p => p ? { ...p, pulsing: false } : null), 400);
      return () => clearTimeout(t);
    }, [combo?.pulsing, combo?.count]);

    // ── Process incoming gift ─────────────────────────────────────────────────
    const emit = useCallback((event: GiftEvent) => {
      const emoji  = GIFT_EMOJI[event.giftId] ?? '✨';
      const name   = resolveDisplayName(event);
      const lane   = laneFor(event.goldCost);
      const now    = Date.now();

      if (lane === 'micro') {
        // Combo tracking
        setCombo(prev => {
          const isCombo =
            prev &&
            prev.giftId === event.giftId &&
            prev.senderName === name &&
            now - prev.lastAt < COMBO_RESET_MS;

          if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
          comboTimerRef.current = setTimeout(() => setCombo(null), COMBO_RESET_MS);

          if (isCombo && prev) {
            return { ...prev, count: prev.count + 1, lastAt: now, pulsing: true };
          }
          return { giftId: event.giftId, giftName: event.giftName, emoji, senderName: name, count: 1, lastAt: now, pulsing: false };
        });

        // Add particle
        setMicroGifts(prev => {
          const active = prev.filter(g => g.expiresAt > now);
          if (active.length >= MICRO_MAX) return active;
          const xIdx = microXIndexRef.current % MICRO_X_POOL.length;
          microXIndexRef.current += 1;
          return [
            ...active,
            {
              id: event.id,
              emoji,
              giftName: event.giftName,
              senderName: name,
              x: MICRO_X_POOL[xIdx],
              expiresAt: now + MICRO_MS,
            },
          ];
        });

      } else if (lane === 'feature') {
        setFeatureGifts(prev => {
          const active = prev.filter(g => g.expiresAt > now);
          if (active.length >= FEATURE_MAX) return prev; // queue could be added later
          return [
            ...active,
            {
              id: event.id,
              emoji,
              giftName: event.giftName,
              goldCost: event.goldCost,
              senderName: name,
              expiresAt: now + FEATURE_MS,
            },
          ];
        });

      } else {
        // Fullscreen — never drop
        const fs: Omit<ActiveFullscreen, 'exiting'> = {
          id: event.id,
          emoji,
          giftName: event.giftName,
          goldCost: event.goldCost,
          senderName: name,
          isAdminTest: event.isAdminTest ?? false,
        };
        setFullscreenGift(prev => {
          if (!prev) return { ...fs, exiting: false };
          setFullscreenQueue(q => [...q, fs]);
          return prev;
        });
      }
    }, []);

    useImperativeHandle(ref, () => ({ emit }), [emit]);

    const dismissFullscreen = useCallback(() => {
      setFullscreenGift(prev => prev ? { ...prev, exiting: true } : null);
      setTimeout(() => setFullscreenGift(null), 600);
    }, []);

    return (
      <>
        {/* ── Micro gift lane ───────────────────────────────────────────── */}
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 51 }} aria-hidden>
          {microGifts.map(g => (
            <MicroGiftParticle key={g.id} gift={g} />
          ))}
        </div>

        {/* ── Combo lane ────────────────────────────────────────────────── */}
        {combo && combo.count >= 2 && (
          <div
            className="fixed pointer-events-none"
            style={{ bottom: 108, left: 16, zIndex: 52 }}
            aria-hidden
          >
            <ComboDisplay combo={combo} />
          </div>
        )}

        {/* ── Feature gift lane ─────────────────────────────────────────── */}
        <div
          className="fixed inset-x-0 pointer-events-none flex flex-col items-center gap-3"
          style={{ bottom: 120, zIndex: 53 }}
          aria-hidden
        >
          {featureGifts.map(g => (
            <FeatureGiftCard key={g.id} gift={g} />
          ))}
        </div>

        {/* ── Fullscreen gift lane ──────────────────────────────────────── */}
        {fullscreenGift && (
          <FullscreenGiftOverlay
            gift={fullscreenGift}
            onDismiss={dismissFullscreen}
          />
        )}
      </>
    );
  },
);

export default GiftAnimationManager;

// ── MicroGiftParticle ──────────────────────────────────────────────────────────

function MicroGiftParticle({ gift }: { gift: ActiveMicro }) {
  return (
    <div
      className="absolute"
      style={{
        bottom: 120,
        right: `${gift.x}%`,
        animation: `arcMicroFloat ${MICRO_MS}ms cubic-bezier(0.2, 0.0, 0.6, 1) forwards`,
        pointerEvents: 'none',
      }}
    >
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full whitespace-nowrap"
        style={{
          background: 'rgba(8,6,2,0.85)',
          border: '1px solid rgba(212,175,55,0.25)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 2px 14px rgba(212,175,55,0.1)',
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>{gift.emoji}</span>
        <span
          className="text-[10px] font-medium text-white/90 max-w-[72px] truncate"
          style={{ letterSpacing: '0.01em' }}
        >
          {gift.senderName}
        </span>
      </div>
    </div>
  );
}

// ── ComboDisplay ───────────────────────────────────────────────────────────────

function ComboDisplay({ combo }: { combo: ComboState }) {
  return (
    <div
      key={`combo-${combo.count}`}
      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, rgba(18,12,2,0.97) 0%, rgba(26,18,2,0.97) 100%)',
        border: '1px solid rgba(212,175,55,0.38)',
        boxShadow: '0 0 28px rgba(212,175,55,0.14), 0 6px 20px rgba(0,0,0,0.55)',
        animation: combo.pulsing ? 'arcComboPulse 0.38s cubic-bezier(.2,.8,.2,1)' : 'none',
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{combo.emoji}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-zinc-500 leading-none truncate max-w-[100px]">
          {combo.senderName}
        </p>
        <p className="text-xs font-semibold text-white leading-tight truncate max-w-[100px]">
          {combo.giftName}
        </p>
      </div>
      <div
        className="flex items-center justify-center rounded-full font-bold text-sm flex-shrink-0"
        style={{
          width: 34,
          height: 34,
          background: 'linear-gradient(135deg, #d4af37 0%, #a8832a 100%)',
          color: '#000',
          boxShadow: '0 0 14px rgba(212,175,55,0.45)',
        }}
      >
        ×{combo.count}
      </div>
    </div>
  );
}

// ── FeatureGiftCard ────────────────────────────────────────────────────────────

function FeatureGiftCard({ gift }: { gift: ActiveFeature }) {
  return (
    <div
      style={{
        animation: 'arcFeatureSpring 0.52s cubic-bezier(0.34,1.56,0.64,1) forwards',
        transformOrigin: 'bottom center',
      }}
    >
      <div
        className="relative flex items-center gap-4 px-5 py-4 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(14,10,1,0.98) 0%, rgba(22,16,2,0.98) 100%)',
          border: '1px solid rgba(212,175,55,0.42)',
          boxShadow: '0 0 44px rgba(212,175,55,0.16), 0 10px 36px rgba(0,0,0,0.65)',
          backdropFilter: 'blur(18px)',
        }}
      >
        {/* Gold top line */}
        <div
          className="absolute top-0 left-6 right-6"
          style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.65), transparent)',
          }}
        />

        {/* Emoji + glow */}
        <div
          className="flex items-center justify-center flex-shrink-0 rounded-xl"
          style={{
            width: 52,
            height: 52,
            fontSize: 26,
            background: 'rgba(212,175,55,0.08)',
            border: '1px solid rgba(212,175,55,0.22)',
            boxShadow: '0 0 22px rgba(212,175,55,0.12)',
          }}
        >
          {gift.emoji}
        </div>

        {/* Text */}
        <div className="min-w-0">
          <p
            className="text-[9.5px] font-bold tracking-[0.22em] uppercase leading-none mb-1"
            style={{ color: 'rgba(212,175,55,0.5)' }}
          >
            {formatGold(gift.goldCost)} Gold Gift
          </p>
          <p className="font-serif text-[17px] text-white leading-none truncate">
            {gift.giftName}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1 leading-none">
            from{' '}
            <span style={{ color: 'rgba(212,175,55,0.75)' }}>{gift.senderName}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── FullscreenGiftOverlay ──────────────────────────────────────────────────────

function FullscreenGiftOverlay({
  gift,
  onDismiss,
}: {
  gift: ActiveFullscreen;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 56,
        animation: gift.exiting
          ? 'arcFullscreenOut 0.6s ease forwards'
          : 'arcFullscreenIn 0.45s ease forwards',
        pointerEvents: gift.exiting ? 'none' : 'auto',
      }}
      onClick={onDismiss}
    >
      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(3,2,0,0.90)', backdropFilter: 'blur(6px)' }}
      />

      {/* Gold particle rain */}
      <GoldParticleRain />

      {/* Center content */}
      <div
        className="relative z-10 text-center px-8 max-w-[380px] mx-auto select-none"
        style={{
          animation: gift.exiting
            ? 'none'
            : 'arcBigReveal 0.72s cubic-bezier(0.16,1,0.3,1) 0.08s both',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Admin test badge */}
        {gift.isAdminTest && (
          <span
            className="inline-block mb-5 text-[9px] font-bold tracking-[0.22em] uppercase px-3 py-1 rounded-full"
            style={{
              background: 'rgba(239,68,68,0.12)',
              color: '#f87171',
              border: '1px solid rgba(239,68,68,0.22)',
            }}
          >
            Admin Test — Gold Not Charged
          </span>
        )}

        {/* Large emoji with gold glow */}
        <div
          style={{
            fontSize: 76,
            lineHeight: 1,
            marginBottom: 28,
            filter: 'drop-shadow(0 0 32px rgba(212,175,55,0.45))',
          }}
        >
          {gift.emoji}
        </div>

        {/* Gift name */}
        <p
          className="font-serif text-[38px] text-white leading-none mb-3"
          style={{ textShadow: '0 0 50px rgba(212,175,55,0.28)' }}
        >
          {gift.giftName}
        </p>

        {/* Gold amount — shimmer text */}
        <p
          className="text-[13px] font-bold tracking-[0.22em] uppercase mb-5"
          style={{
            background: 'linear-gradient(90deg, #a8832a 0%, #d4af37 30%, #f0d060 50%, #d4af37 70%, #a8832a 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'arcGoldShimmer 2.4s linear infinite',
          }}
        >
          {formatGold(gift.goldCost)} Gold
        </p>

        {/* Divider */}
        <div
          className="mx-auto mb-5"
          style={{
            width: 72,
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.65), transparent)',
          }}
        />

        {/* Sender */}
        <p className="text-sm text-zinc-400 leading-relaxed">
          sent by{' '}
          <span className="font-semibold text-white">{gift.senderName}</span>
        </p>

        {/* Dismiss hint */}
        <p
          className="text-[10px] tracking-[0.18em] uppercase mt-8"
          style={{ color: 'rgba(255,255,255,0.18)' }}
        >
          tap to dismiss
        </p>
      </div>
    </div>
  );
}

// ── GoldParticleRain ───────────────────────────────────────────────────────────

function GoldParticleRain() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {GOLD_PARTICLES.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: -8,
            width:  p.size,
            height: p.size,
            background: `rgba(212,175,55,${0.25 + (p.id % 5) * 0.1})`,
            boxShadow: `0 0 ${p.size * 2}px rgba(212,175,55,0.35)`,
            animation: `arcGoldFall ${p.dur}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
