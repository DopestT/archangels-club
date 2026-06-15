import React, { useState, useEffect, useCallback } from 'react';
import { Lock, X, ChevronDown, Send } from 'lucide-react';
import { apiFetch, API_BASE } from '../../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

export type GiftPrivacy = 'public' | 'private' | 'ghost';

interface PatronStatus {
  patron_level: number;
  level_name: string;
  total_gold: number;
  next_level: number | null;
  next_level_name: string | null;
  next_threshold: number | null;
  creator_id: string;
}

interface GiftDef {
  id: string;
  label: string;
  goldCost: number;
  patronLevel: number;
  patronName: string;
  icon: React.ReactNode;
}

// ── Patron level definitions ───────────────────────────────────────────────────

const PATRON_LEVELS = [
  { level: 1, name: 'Guest Patron',        threshold: 0     },
  { level: 2, name: 'Inner Circle Patron', threshold: 500   },
  { level: 3, name: 'Vault Patron',        threshold: 2500  },
  { level: 4, name: 'Crown Patron',        threshold: 10000 },
  { level: 5, name: 'Archangel Patron',    threshold: 25000 },
];

// ── Gift icons (inline SVG, no external deps) ─────────────────────────────────

function Icon({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <span style={{ opacity: dim ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </span>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  gold_rain: (
    <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
      <circle cx="14" cy="9" r="6" stroke="#D4AF37" strokeWidth="1.3" fill="rgba(212,175,55,0.10)" />
      <path d="M9 18L14 26L19 18" stroke="#D4AF37" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".6"/>
      <circle cx="7" cy="22" r="1.2" fill="#D4AF37" opacity=".35"/>
      <circle cx="21" cy="24" r="1" fill="#D4AF37" opacity=".25"/>
    </svg>
  ),
  halo_drop: (
    <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
      <ellipse cx="14" cy="7" rx="8" ry="2.5" stroke="#D4AF37" strokeWidth="1.2" fill="none"/>
      <path d="M11.5 7L14 22L16.5 7" stroke="#D4AF37" strokeWidth="1.1" fill="rgba(212,175,55,0.08)"/>
    </svg>
  ),
  wings_open: (
    <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
      <path d="M14 17C9 17 3 13 2 7C6 9 10 10 14 10C18 10 22 9 26 7C25 13 19 17 14 17Z" stroke="#D4AF37" strokeWidth="1.1" fill="rgba(212,175,55,0.09)"/>
      <circle cx="14" cy="21" r="1.5" fill="#D4AF37" opacity=".6"/>
    </svg>
  ),
  crown_signal: (
    <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
      <path d="M3 20L7 11L12.5 16L14 7L15.5 16L21 11L25 20Z" stroke="#D4AF37" strokeWidth="1.2" fill="rgba(212,175,55,0.10)"/>
      <rect x="3" y="20" width="22" height="2.5" rx=".8" stroke="#D4AF37" strokeWidth="1.1" fill="none"/>
    </svg>
  ),
  vault_key: (
    <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
      <circle cx="10" cy="12" r="6" stroke="#D4AF37" strokeWidth="1.3" fill="rgba(212,175,55,0.08)"/>
      <path d="M14.5 15L24 21L22 24L19.5 22L18 24L16 21.5" stroke="#D4AF37" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="10" cy="12" r="2" fill="#D4AF37" opacity=".45"/>
    </svg>
  ),
  private_tribute: (
    <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
      <path d="M14 5L17.5 10.5L24 11.5L19.5 16L20.5 23L14 19.5L7.5 23L8.5 16L4 11.5L10.5 10.5Z" stroke="#D4AF37" strokeWidth="1.2" fill="rgba(212,175,55,0.09)"/>
    </svg>
  ),
  room_blessing: (
    <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
      <circle cx="14" cy="14" r="10" stroke="#D4AF37" strokeWidth="1.1" fill="none"/>
      <circle cx="14" cy="14" r="6"  stroke="#D4AF37" strokeWidth="1"   fill="rgba(212,175,55,0.07)"/>
      <path d="M14 8V6M14 22V20M8 14H6M22 14H20" stroke="#D4AF37" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  ),
  after_hours: (
    <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
      <path d="M19 14C19 18.4 15.9 22 11.5 22 11 22 10.5 22 10 21.9 12 21 13.5 19.1 13.5 17 13.5 14 11.2 11.5 8.2 11.2 9.1 8.3 11.8 6.2 15 6.2 17.2 6.2 19 8 19 10.2" stroke="#D4AF37" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <circle cx="19" cy="12.5" r="2.5" stroke="#D4AF37" strokeWidth="1" fill="rgba(212,175,55,0.09)"/>
    </svg>
  ),
  private_encore: (
    <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
      <path d="M6 22V11L14 6L22 11V22" stroke="#D4AF37" strokeWidth="1.2" fill="rgba(212,175,55,0.06)"/>
      <rect x="9.5" y="17" width="9" height="5" rx=".5" stroke="#D4AF37" strokeWidth="1.1" fill="none"/>
      <circle cx="14" cy="11" r="2.5" stroke="#D4AF37" strokeWidth="1" fill="rgba(212,175,55,0.14)"/>
    </svg>
  ),
  vault_drop: (
    <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
      <rect x="4" y="4" width="20" height="15" rx="1.5" stroke="#D4AF37" strokeWidth="1.2" fill="rgba(212,175,55,0.06)"/>
      <circle cx="14" cy="11.5" r="3.5" stroke="#D4AF37" strokeWidth="1" fill="rgba(212,175,55,0.10)"/>
      <path d="M11 24L14 20L17 24" stroke="#D4AF37" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  creator_blessing: (
    <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
      <circle cx="14" cy="14" r="11" stroke="#D4AF37" strokeWidth="1"   fill="none" opacity=".35"/>
      <circle cx="14" cy="14" r="7"  stroke="#D4AF37" strokeWidth="1.1" fill="none" opacity=".65"/>
      <circle cx="14" cy="14" r="3.5" stroke="#D4AF37" strokeWidth="1.3" fill="rgba(212,175,55,0.18)"/>
      <path d="M14 3V2M14 26V25M3 14H2M26 14H25M6 6L5 5M22 6L23 5M6 22L5 23M22 22L23 23" stroke="#D4AF37" strokeWidth=".9" strokeLinecap="round" opacity=".4"/>
    </svg>
  ),
};

// ── Gift catalogue ─────────────────────────────────────────────────────────────

const GIFTS: GiftDef[] = [
  { id: 'gold_rain',        label: 'Gold Rain',             goldCost: 100,   patronLevel: 1, patronName: 'Guest Patron',        icon: ICONS.gold_rain },
  { id: 'halo_drop',        label: 'Halo Drop',             goldCost: 250,   patronLevel: 1, patronName: 'Guest Patron',        icon: ICONS.halo_drop },
  { id: 'wings_open',       label: 'Wings Open',            goldCost: 500,   patronLevel: 2, patronName: 'Inner Circle Patron', icon: ICONS.wings_open },
  { id: 'crown_signal',     label: 'Crown Signal',          goldCost: 1000,  patronLevel: 2, patronName: 'Inner Circle Patron', icon: ICONS.crown_signal },
  { id: 'vault_key',        label: 'Vault Key',             goldCost: 2500,  patronLevel: 3, patronName: 'Vault Patron',        icon: ICONS.vault_key },
  { id: 'private_tribute',  label: 'Private Tribute',       goldCost: 5000,  patronLevel: 3, patronName: 'Vault Patron',        icon: ICONS.private_tribute },
  { id: 'room_blessing',    label: 'Room Blessing',         goldCost: 10000, patronLevel: 4, patronName: 'Crown Patron',        icon: ICONS.room_blessing },
  { id: 'after_hours',      label: 'After-Hours Signal',    goldCost: 12000, patronLevel: 4, patronName: 'Crown Patron',        icon: ICONS.after_hours },
  { id: 'private_encore',   label: 'Private Encore Signal', goldCost: 15000, patronLevel: 5, patronName: 'Archangel Patron',   icon: ICONS.private_encore },
  { id: 'vault_drop',       label: 'Vault Drop Signal',     goldCost: 20000, patronLevel: 5, patronName: 'Archangel Patron',   icon: ICONS.vault_drop },
  { id: 'creator_blessing', label: 'Creator Blessing',      goldCost: 25000, patronLevel: 5, patronName: 'Archangel Patron',   icon: ICONS.creator_blessing },
];

const PRIVACY_OPTS: { value: GiftPrivacy; label: string; sub: string }[] = [
  { value: 'public',  label: 'Send Publicly',  sub: 'Your name appears in the room' },
  { value: 'private', label: 'Send Privately', sub: 'Shows as "Private Patron"' },
  { value: 'ghost',   label: 'Ghost Gift',     sub: 'Anonymous — no name shown' },
];

function formatGold(n: number): string {
  if (n >= 1000) return `${(n / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`;
  return n.toLocaleString();
}

// ── PatronStatusBar ────────────────────────────────────────────────────────────

function PatronStatusBar({ status }: { status: PatronStatus }) {
  const current = PATRON_LEVELS.find(l => l.level === status.patron_level) ?? PATRON_LEVELS[0];
  const prevThreshold = current.threshold;
  const range = status.next_threshold ? status.next_threshold - prevThreshold : 0;
  const progress = range > 0 ? Math.min(100, ((status.total_gold - prevThreshold) / range) * 100) : 100;
  const remaining = status.next_threshold ? status.next_threshold - status.total_gold : 0;

  return (
    <div
      className="mx-5 mb-4 px-4 py-3 rounded-xl"
      style={{
        background: 'linear-gradient(135deg, rgba(212,175,55,0.05) 0%, rgba(10,10,15,0.8) 100%)',
        border: '1px solid rgba(212,175,55,0.14)',
      }}
    >
      <p className="text-[9.5px] font-bold tracking-[0.20em] uppercase text-gold/50 mb-1.5">
        Your Patron Status
      </p>
      <p className="font-serif text-sm text-white leading-none">{status.level_name}</p>

      {status.next_threshold ? (
        <>
          <div
            className="my-2.5 rounded-full overflow-hidden"
            style={{ height: '1.5px', background: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, rgba(212,175,55,0.5) 0%, rgba(212,175,55,0.9) 100%)',
                boxShadow: '0 0 4px rgba(212,175,55,0.35)',
                transition: 'width 0.8s ease',
              }}
            />
          </div>
          <p className="text-[10px] text-arc-muted leading-none">
            <span className="text-gold/65">{status.total_gold.toLocaleString()} Gold</span>
            <span className="mx-1.5 opacity-40">·</span>
            {remaining.toLocaleString()} Gold to{' '}
            <span className="text-arc-secondary">{status.next_level_name}</span>
          </p>
        </>
      ) : (
        <p className="text-[10px] text-gold/45 mt-1.5">Highest Patron Status</p>
      )}
    </div>
  );
}

// ── PatronUnlockMoment ────────────────────────────────────────────────────────

function PatronUnlockMoment({ levelName, onDismiss }: { levelName: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4800);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <>
      <style>{`
        @keyframes __haloExpand {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes __fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl"
        style={{ background: 'rgba(4,4,8,0.94)', backdropFilter: 'blur(10px)' }}
        onClick={onDismiss}
      >
        <div className="text-center px-8 select-none">
          <div
            style={{
              width: 60, height: 60, borderRadius: '50%', margin: '0 auto 24px',
              border: '1px solid rgba(212,175,55,0.55)',
              boxShadow: '0 0 28px rgba(212,175,55,0.18), inset 0 0 16px rgba(212,175,55,0.05)',
              animation: '__haloExpand 0.9s cubic-bezier(0.16,1,0.3,1) forwards',
            }}
          />
          <p
            className="text-[9.5px] font-bold tracking-[0.22em] uppercase text-gold/50 mb-2"
            style={{ animation: '__fadeUp 0.55s 0.35s ease-out both' }}
          >
            Patron Access Unlocked
          </p>
          <p
            className="font-serif text-[22px] text-white mb-2 leading-tight"
            style={{ animation: '__fadeUp 0.55s 0.5s ease-out both' }}
          >
            {levelName}
          </p>
          <p
            className="text-xs text-arc-secondary leading-relaxed max-w-[220px] mx-auto"
            style={{ animation: '__fadeUp 0.55s 0.65s ease-out both' }}
          >
            New gifts are now available inside the room.
          </p>
          <button
            className="mt-7 text-[10px] text-arc-muted hover:text-white transition-colors tracking-[0.18em] uppercase"
            style={{ animation: '__fadeUp 0.55s 1s ease-out both' }}
            onClick={onDismiss}
          >
            Continue
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  roomId: string;
  creatorId: string;
  onClose: () => void;
  onSent?: (giftLabel: string, privacy: GiftPrivacy) => void;
}

export default function GoldGiftDrawer({ roomId, creatorId, onClose, onSent }: Props) {
  const [patronStatus, setPatronStatus] = useState<PatronStatus | null>(null);
  const [selected, setSelected]         = useState<GiftDef | null>(null);
  const [privacy, setPrivacy]           = useState<GiftPrivacy>('public');
  const [message, setMessage]           = useState('');
  const [sending, setSending]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy]   = useState(false);
  const [lockedHint, setLockedHint]     = useState<string | null>(null);
  const [showUnlock, setShowUnlock]     = useState(false);
  const [unlockName, setUnlockName]     = useState('');

  const fetchPatronStatus = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/live/${roomId}/patron-status`) as PatronStatus & { error?: string };
      if (data.error) return;

      // Detect level-up from localStorage
      const stored = localStorage.getItem(`arc_patron_${creatorId}`);
      const prev = stored ? JSON.parse(stored) as { level: number } : null;
      if (prev && data.patron_level > prev.level) {
        setUnlockName(data.level_name);
        setShowUnlock(true);
      }
      localStorage.setItem(`arc_patron_${creatorId}`, JSON.stringify({ level: data.patron_level }));
      setPatronStatus(data);
    } catch {}
  }, [roomId, creatorId]);

  useEffect(() => { fetchPatronStatus(); }, [fetchPatronStatus]);

  async function handleSend() {
    if (!selected || sending) return;
    setSending(true);
    setError(null);

    // Store level before redirect so we can detect level-up on return
    if (patronStatus) {
      localStorage.setItem(`arc_patron_${creatorId}`, JSON.stringify({ level: patronStatus.patron_level }));
    }

    try {
      const data = await apiFetch(`/api/live/${roomId}/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_cents: selected.goldCost,
          creator_id:   creatorId,
          privacy,
          gift_type:    selected.id,
          message:      message.trim() || undefined,
        }),
      }) as { url?: string; error?: string };

      if (data.error) { setError(data.error); return; }
      if (data.url) { window.location.href = data.url; return; }
      onSent?.(selected.label, privacy);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send gift. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const currentLevel = patronStatus?.patron_level ?? 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/72 backdrop-blur-sm" />

      <div
        className="relative w-full sm:max-w-[400px] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'linear-gradient(180deg, rgba(12,12,18,0.99) 0%, rgba(7,7,11,0.99) 100%)',
          border: '1px solid rgba(212,175,55,0.13)',
          boxShadow: '0 0 80px rgba(212,175,55,0.07), 0 28px 60px rgba(0,0,0,0.65)',
          maxHeight: '92dvh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Patron unlock overlay */}
        {showUnlock && (
          <PatronUnlockMoment levelName={unlockName} onDismiss={() => setShowUnlock(false)} />
        )}

        {/* Gold top line */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)', flexShrink: 0 }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div>
            <p className="font-serif text-[17px] text-white leading-none">Send a Gift</p>
            <p className="text-[9.5px] tracking-[0.2em] text-zinc-600 uppercase mt-1">Gold Reserve</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-600 hover:text-white hover:bg-white/7 transition-all">
            <X size={15} />
          </button>
        </div>

        {/* Patron status */}
        {patronStatus && <PatronStatusBar status={patronStatus} />}

        {/* Gift grid — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pb-1" style={{ overscrollBehavior: 'contain' }}>
          <div className="grid grid-cols-2 gap-2">
            {GIFTS.map((gift) => {
              const locked = gift.patronLevel > currentLevel;
              const isSelected = selected?.id === gift.id;
              const showHint = lockedHint === gift.id;

              return (
                <div key={gift.id} className="relative">
                  <button
                    onClick={() => {
                      if (locked) {
                        setLockedHint(gift.id);
                        setTimeout(() => setLockedHint(null), 2600);
                      } else {
                        setSelected(isSelected ? null : gift);
                        setError(null);
                      }
                    }}
                    className="relative w-full text-left rounded-xl p-3 transition-all duration-150 group"
                    style={{
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(212,175,55,0.11) 0%, rgba(18,18,26,0.95) 100%)'
                        : locked
                        ? 'rgba(255,255,255,0.015)'
                        : 'rgba(255,255,255,0.035)',
                      border: isSelected
                        ? '1px solid rgba(212,175,55,0.32)'
                        : locked
                        ? '1px solid rgba(255,255,255,0.035)'
                        : '1px solid rgba(255,255,255,0.055)',
                      boxShadow: isSelected ? '0 0 16px rgba(212,175,55,0.07)' : 'none',
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Icon dim={locked}>{gift.icon}</Icon>
                      {locked && <Lock size={10} className="text-zinc-700 mt-0.5 flex-shrink-0" />}
                    </div>
                    <p
                      className="text-[11.5px] font-medium leading-tight mb-0.5"
                      style={{ color: locked ? '#52525b' : isSelected ? '#fff' : '#d4d4d8' }}
                    >
                      {gift.label}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: locked ? '#3f3f46' : isSelected ? 'rgba(212,175,55,0.7)' : 'rgba(212,175,55,0.45)' }}
                    >
                      {formatGold(gift.goldCost)} Gold
                    </p>
                    {locked && (
                      <p className="text-[9px] mt-0.5" style={{ color: '#3f3f46' }}>
                        {gift.patronName}
                      </p>
                    )}
                  </button>

                  {/* Locked tap tooltip */}
                  {showHint && (
                    <div
                      className="absolute left-0 right-0 bottom-full mb-1.5 z-10 px-3 py-2 rounded-lg text-center"
                      style={{
                        background: 'rgba(10,10,16,0.98)',
                        border: '1px solid rgba(212,175,55,0.18)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
                      }}
                    >
                      <p className="text-[10px] text-zinc-400">
                        Unlocks at{' '}
                        <span className="text-gold">{gift.patronName}</span>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Send panel */}
        {selected && (
          <div
            className="mx-5 mt-3 mb-5 rounded-xl p-4 space-y-3 flex-shrink-0"
            style={{
              background: 'rgba(212,175,55,0.04)',
              border: '1px solid rgba(212,175,55,0.10)',
            }}
          >
            {/* Selected gift summary */}
            <div className="flex items-center gap-3">
              <span style={{ opacity: 0.85 }}>{selected.icon}</span>
              <div>
                <p className="text-[13px] font-medium text-white leading-none">{selected.label}</p>
                <p className="text-[10px] text-gold/55 mt-0.5">{formatGold(selected.goldCost)} Gold</p>
              </div>
            </div>

            {/* Message */}
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Add a private message (optional)"
              maxLength={120}
              className="w-full bg-zinc-900/60 border border-white/7 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-gold/25 transition-colors"
            />

            {/* Privacy + send */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <button
                  onClick={() => setShowPrivacy(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-zinc-400 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <span>{PRIVACY_OPTS.find(p => p.value === privacy)?.label}</span>
                  <ChevronDown size={11} className="text-zinc-600 flex-shrink-0" />
                </button>
                {showPrivacy && (
                  <div
                    className="absolute left-0 right-0 bottom-full mb-1 rounded-xl overflow-hidden z-10"
                    style={{ background: 'rgba(14,14,20,0.99)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 28px rgba(0,0,0,0.5)' }}
                  >
                    {PRIVACY_OPTS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setPrivacy(opt.value); setShowPrivacy(false); }}
                        className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/4 last:border-0"
                      >
                        <p className={`text-[11.5px] font-medium ${opt.value === privacy ? 'text-gold' : 'text-zinc-300'}`}>{opt.label}</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{opt.sub}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-gold text-black hover:bg-gold/90 disabled:opacity-50 transition-all flex-shrink-0"
              >
                {sending ? (
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : <Send size={11} />}
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>

            {error && <p className="text-[10px] text-arc-error">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
