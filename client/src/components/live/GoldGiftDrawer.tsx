import React, { useState } from 'react';
import { X, Sparkles, Zap, Star, Crown, Heart, Flame } from 'lucide-react';
import { apiFetch } from '../../lib/api';

// TODO(gold-economy): Replace these Stripe-backed tip amounts with virtual Gold coin
// purchases once the Gold ledger table and top-up flow are implemented.
// Each "gift" maps to a dollar amount right now — a fan is just tipping.

interface Gift {
  id: string;
  icon: React.ReactNode;
  label: string;
  amountCents: number;
  goldValue: number; // displayed as "X Gold" — cosmetic for now
}

const GIFTS: Gift[] = [
  { id: 'spark',  icon: <Zap    size={22} className="text-yellow-300" />, label: 'Spark',   amountCents: 100,  goldValue: 10  },
  { id: 'star',   icon: <Star   size={22} className="text-yellow-400" />, label: 'Star',    amountCents: 500,  goldValue: 50  },
  { id: 'heart',  icon: <Heart  size={22} className="text-red-400"    />, label: 'Heart',   amountCents: 1000, goldValue: 100 },
  { id: 'flame',  icon: <Flame  size={22} className="text-orange-400" />, label: 'Flame',   amountCents: 2000, goldValue: 200 },
  { id: 'angel',  icon: <Sparkles size={22} className="text-gold"     />, label: 'Angel',   amountCents: 5000, goldValue: 500 },
  { id: 'crown',  icon: <Crown  size={22} className="text-yellow-300" />, label: 'Crown',   amountCents: 10000, goldValue: 1000 },
];

interface Props {
  roomId: string;
  creatorId: string;
  onClose: () => void;
  onSent?: (giftLabel: string) => void;
}

export default function GoldGiftDrawer({ roomId, creatorId, onClose, onSent }: Props) {
  const [selected, setSelected] = useState<Gift>(GIFTS[0]);
  const [message, setMessage]   = useState('');
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSend() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      // TODO(gold-economy): When virtual Gold currency is live, deduct from the
      // user's Gold balance instead of creating a Stripe session.
      const data = await apiFetch(`/api/live/${roomId}/tip`, {
        method: 'POST',
        body: JSON.stringify({
          amount_cents: selected.amountCents,
          message: message.trim() || undefined,
        }),
      }) as { url?: string; ok?: boolean };

      if (data.url) {
        window.location.href = data.url;
      } else {
        onSent?.(selected.label);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send gift.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-zinc-950 border border-yellow-600/20 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-yellow-400" />
            <span className="font-semibold text-white text-sm">Send a Gold Gift</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors arc-pressable">
            <X size={18} />
          </button>
        </div>

        {/* Gift grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {GIFTS.map(gift => (
            <button
              key={gift.id}
              onClick={() => setSelected(gift)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-150 arc-pressable ${
                selected.id === gift.id
                  ? 'border-yellow-500/60 bg-yellow-500/10'
                  : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900'
              }`}
            >
              {gift.icon}
              <span className="text-[11px] text-zinc-300">{gift.label}</span>
              <span className="text-[10px] text-yellow-500 font-medium">{gift.goldValue} Gold</span>
            </button>
          ))}
        </div>

        {/* Message */}
        <input
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Add a message… (optional)"
          maxLength={80}
          className="input-dark text-xs mb-3"
        />

        {/* Error */}
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={sending}
          className="btn-gold w-full"
        >
          {sending ? 'Sending…' : `Send ${selected.label} · $${(selected.amountCents / 100).toFixed(0)}`}
        </button>

        <p className="text-[10px] text-zinc-600 text-center mt-2">
          {/* TODO(gold-economy): Replace with "Deducted from your Gold balance" once ledger is live */}
          Charged via Stripe · 70% goes to the creator
        </p>
      </div>
    </div>
  );
}
