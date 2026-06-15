import React, { useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '../../lib/api';

// TODO(gold-economy): When the Gold ledger is live, replace Stripe sessions with
// virtual Gold deduction. Each gift tier currently maps to a real dollar amount.
// 10 Gold ≈ $1 as a rough placeholder — thresholds should come from platform config.

export type GiftPrivacy = 'public' | 'private' | 'ghost';

interface Gift {
  id: string;
  label: string;
  goldCost: number;
  amountCents: number;
  tier: number;
  animationHint: string;
}

const GIFTS: Gift[] = [
  { id: 'gold_rain',       label: 'Gold Rain',       goldCost: 100,   amountCents: 100,   tier: 1, animationHint: 'Soft gold shimmer' },
  { id: 'halo_drop',       label: 'Halo Drop',       goldCost: 250,   amountCents: 250,   tier: 2, animationHint: 'Halo descends' },
  { id: 'wings_open',      label: 'Wings Open',      goldCost: 500,   amountCents: 500,   tier: 3, animationHint: 'Wings unfold' },
  { id: 'crown_signal',    label: 'Crown Signal',    goldCost: 1000,  amountCents: 1000,  tier: 4, animationHint: 'Crown flare' },
  { id: 'vault_key',       label: 'Vault Key',       goldCost: 2500,  amountCents: 2500,  tier: 5, animationHint: 'Key dissolves' },
  { id: 'private_tribute', label: 'Private Tribute', goldCost: 5000,  amountCents: 5000,  tier: 6, animationHint: 'Private beam' },
  { id: 'room_blessing',   label: 'Room Blessing',   goldCost: 10000, amountCents: 10000, tier: 7, animationHint: 'Gold aura' },
];

const PRIVACY_OPTIONS: { value: GiftPrivacy; label: string; sub: string }[] = [
  { value: 'public',  label: 'Send Publicly',    sub: 'Your name appears in the room' },
  { value: 'private', label: 'Send Privately',   sub: 'Shows as "Private Patron"' },
  { value: 'ghost',   label: 'Ghost Gift',       sub: 'Shows as "A private gift was sent"' },
];

interface Props {
  roomId: string;
  creatorId: string;
  onClose: () => void;
  onSent?: (giftLabel: string, privacy: GiftPrivacy) => void;
}

export default function GoldGiftDrawer({ roomId, creatorId, onClose, onSent }: Props) {
  const [selected, setSelected]   = useState<Gift>(GIFTS[0]);
  const [privacy, setPrivacy]     = useState<GiftPrivacy>('public');
  const [message, setMessage]     = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleSend() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const data = await apiFetch(`/api/live/${roomId}/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_cents: selected.amountCents,
          creator_id:   creatorId,
          privacy,
          message: message.trim() || undefined,
        }),
      }) as { url?: string; ok?: boolean };

      if (data.url) {
        window.location.href = data.url;
      } else {
        onSent?.(selected.label, privacy);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send gift.');
    } finally {
      setSending(false);
    }
  }

  const selectedPrivacy = PRIVACY_OPTIONS.find(p => p.value === privacy)!;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #0d0d0f 0%, #080808 100%)',
          border: '1px solid rgba(212,175,55,0.2)',
          boxShadow: '0 0 60px rgba(212,175,55,0.08)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Gold top line */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #d4af37, transparent)' }} />

        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-serif text-sm tracking-wide">Send a Gift</p>
              <p className="text-[10px] tracking-[0.2em] text-zinc-600 uppercase mt-0.5">Gold Reserve</p>
            </div>
            <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors p-1">
              <X size={16} />
            </button>
          </div>

          {/* Gift grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {GIFTS.map(gift => {
              const isSelected = selected.id === gift.id;
              return (
                <button
                  key={gift.id}
                  onClick={() => setSelected(gift)}
                  className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition-all duration-150"
                  style={{
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.06))'
                      : 'rgba(255,255,255,0.03)',
                    border: isSelected
                      ? '1px solid rgba(212,175,55,0.4)'
                      : '1px solid rgba(255,255,255,0.05)',
                    boxShadow: isSelected ? '0 0 12px rgba(212,175,55,0.06)' : 'none',
                  }}
                >
                  <GiftIcon id={gift.id} active={isSelected} />
                  <span
                    className="text-[9px] leading-tight text-center font-medium"
                    style={{ color: isSelected ? '#d4af37' : '#71717a' }}
                  >
                    {gift.label}
                  </span>
                  <span className="text-[9px]" style={{ color: isSelected ? 'rgba(212,175,55,0.7)' : '#3f3f46' }}>
                    {gift.goldCost >= 1000 ? `${gift.goldCost / 1000}k` : gift.goldCost}G
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected gift info */}
          <div
            className="flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.1)' }}
          >
            <div>
              <p className="text-white text-xs font-medium">{selected.label}</p>
              <p className="text-zinc-600 text-[10px]">{selected.animationHint} · Tier {selected.tier}</p>
            </div>
            <div className="text-right">
              <p style={{ color: '#d4af37' }} className="text-xs font-semibold">
                {selected.goldCost.toLocaleString()} Gold
              </p>
              <p className="text-zinc-600 text-[10px]">
                ${(selected.amountCents / 100).toFixed(selected.amountCents < 100 ? 2 : 0)}
              </p>
            </div>
          </div>

          {/* Privacy selector */}
          <div>
            <button
              onClick={() => setShowPrivacy(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="text-left">
                <p className="text-xs text-zinc-300">{selectedPrivacy.label}</p>
                <p className="text-[10px] text-zinc-600">{selectedPrivacy.sub}</p>
              </div>
              <span className="text-zinc-600 text-[10px] tracking-wider">
                {showPrivacy ? '▲' : '▼'}
              </span>
            </button>

            {showPrivacy && (
              <div
                className="mt-1 rounded-lg overflow-hidden divide-y"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {PRIVACY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setPrivacy(opt.value); setShowPrivacy(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors text-left"
                  >
                    <div>
                      <p className="text-xs text-zinc-300">{opt.label}</p>
                      <p className="text-[10px] text-zinc-600">{opt.sub}</p>
                    </div>
                    {privacy === opt.value && (
                      <span style={{ color: '#d4af37', fontSize: 10 }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Optional message (hidden for ghost gifts) */}
          {privacy !== 'ghost' && (
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Add a message… (optional)"
              maxLength={80}
              className="w-full bg-transparent text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none px-3 py-2 rounded-lg"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}
            />
          )}

          {error && <p className="text-red-400 text-[11px]">{error}</p>}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #a8832a 100%)',
              color: '#000',
              boxShadow: '0 0 20px rgba(212,175,55,0.15)',
            }}
          >
            {sending ? 'Sending…' : `Send ${selected.label}`}
          </button>

          <p className="text-[10px] text-zinc-700 text-center">
            {/* TODO(gold-economy): Replace with Gold balance deduction once ledger is live */}
            Charged via Stripe · 70% goes to the creator
          </p>
        </div>
      </div>
    </div>
  );
}

function GiftIcon({ id, active }: { id: string; active: boolean }) {
  const color = active ? '#d4af37' : '#52525b';
  const size  = 18;

  const icons: Record<string, React.ReactNode> = {
    gold_rain: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M3 12h.01M7 8h.01M11 12h.01M15 8h.01M19 12h.01M7 16h.01M15 16h.01M11 4h.01" strokeLinecap="round" />
      </svg>
    ),
    halo_drop: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <ellipse cx="12" cy="8" rx="8" ry="3" />
        <path d="M12 8v8" strokeLinecap="round" />
      </svg>
    ),
    wings_open: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M12 12C9 8 4 7 2 10s2 6 5 6M12 12c3-4 8-5 10-2s-2 6-5 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    crown_signal: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M3 17l3-9 3 5 3-8 3 5 3-5v9H3z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 20h18" strokeLinecap="round" />
      </svg>
    ),
    vault_key: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <circle cx="8" cy="12" r="4" />
        <path d="M12 12h8M17 10v4" strokeLinecap="round" />
      </svg>
    ),
    private_tribute: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M12 3l9 4.5v5C21 17 17 21 12 22 7 21 3 17 3 12.5v-5L12 3z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    room_blessing: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2" strokeLinecap="round" />
      </svg>
    ),
  };

  return icons[id] ?? null;
}
