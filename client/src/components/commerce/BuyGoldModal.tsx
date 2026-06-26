import React, { useState } from 'react';
import { X, Coins, Sparkles, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface GoldPackage {
  id: string;
  gold: number;
  price_cents: number;
  label: string;
  badge: string | null;
}

const PACKAGES: GoldPackage[] = [
  { id: 'gold_500',   gold: 500,   price_cents: 499,  label: '500 Gold',    badge: null         },
  { id: 'gold_1100',  gold: 1100,  price_cents: 999,  label: '1,100 Gold',  badge: 'Popular'    },
  { id: 'gold_3000',  gold: 3000,  price_cents: 2499, label: '3,000 Gold',  badge: null         },
  { id: 'gold_6500',  gold: 6500,  price_cents: 4999, label: '6,500 Gold',  badge: 'Best Value' },
  { id: 'gold_14000', gold: 14000, price_cents: 9999, label: '14,000 Gold', badge: null         },
];

function formatUSD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatGold(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

interface Props {
  onClose: () => void;
  returnUrl?: string;
  currentBalance?: number;
  requiredGold?: number;
}

export default function BuyGoldModal({ onClose, returnUrl, currentBalance, requiredGold }: Props) {
  const [selected, setSelected] = useState<GoldPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuy = async () => {
    if (!selected || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/gold/checkout', {
        method: 'POST',
        body: JSON.stringify({
          package_id: selected.id,
          return_url: returnUrl ?? window.location.href,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Checkout failed.'); return; }
      if (data.url) window.location.href = data.url;
    } catch {
      setError('Could not start checkout. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      <div
        className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'linear-gradient(180deg, rgba(12,12,18,0.99) 0%, rgba(7,7,11,0.99) 100%)',
          border: '1px solid rgba(212,175,55,0.18)',
          boxShadow: '0 0 80px rgba(212,175,55,0.08), 0 28px 60px rgba(0,0,0,0.7)',
          maxHeight: '92dvh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Gold top line */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent)', flexShrink: 0 }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <Coins className="h-5 w-5 text-gold" />
            <div>
              <p className="font-semibold text-white text-base leading-none">Buy Gold</p>
              <p className="text-[10px] tracking-[0.18em] text-arc-muted uppercase mt-0.5">Add Gold to your balance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-arc-muted hover:text-white hover:bg-white/7 transition-all">
            <X size={15} />
          </button>
        </div>

        {/* Current balance / need more */}
        {(currentBalance !== undefined || requiredGold !== undefined) && (
          <div className="mx-5 mb-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.12)' }}>
            {currentBalance !== undefined && (
              <p className="text-xs text-arc-secondary">
                Current balance: <span className="font-semibold text-gold">{currentBalance.toLocaleString()} Gold</span>
              </p>
            )}
            {requiredGold !== undefined && currentBalance !== undefined && (
              <p className="text-xs text-arc-muted mt-0.5">
                You need <span className="text-white font-medium">{(requiredGold - currentBalance).toLocaleString()} more Gold</span> for this gift
              </p>
            )}
          </div>
        )}

        {/* Packages */}
        <div className="flex-1 overflow-y-auto px-5 pb-2" style={{ overscrollBehavior: 'contain' }}>
          <div className="space-y-2">
            {PACKAGES.map(pkg => {
              const isSelected = selected?.id === pkg.id;
              const getsEnough = requiredGold !== undefined && currentBalance !== undefined
                ? (currentBalance + pkg.gold) >= requiredGold
                : true;

              return (
                <button
                  key={pkg.id}
                  onClick={() => setSelected(isSelected ? null : pkg)}
                  className="relative w-full text-left rounded-xl px-4 py-3.5 transition-all duration-150"
                  style={{
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(18,18,26,0.95) 100%)'
                      : 'rgba(255,255,255,0.03)',
                    border: isSelected
                      ? '1px solid rgba(212,175,55,0.38)'
                      : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: isSelected ? '0 0 18px rgba(212,175,55,0.08)' : 'none',
                  }}
                >
                  {pkg.badge && (
                    <span
                      className="absolute top-2.5 right-3 text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
                    >
                      {pkg.badge}
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(212,175,55,0.08)' }}>
                      <Sparkles className="h-4 w-4 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                        {pkg.label}
                      </p>
                      {getsEnough && requiredGold !== undefined && (
                        <p className="text-[10px] text-gold/60 mt-0.5">Enough for this gift</p>
                      )}
                    </div>
                    <p className={`text-sm font-bold shrink-0 ${isSelected ? 'text-gold' : 'text-zinc-400'}`}>
                      {formatUSD(pkg.price_cents)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compliance note */}
        <div className="mx-5 mt-2 flex items-start gap-2">
          <ShieldCheck className="h-3 w-3 shrink-0 text-arc-muted mt-0.5" />
          <p className="text-[10px] text-arc-muted leading-relaxed">
            Gold is a closed-platform digital credit. Not crypto. Not cash. Not withdrawable.
            For entertainment use only. All sales final.
          </p>
        </div>

        {/* CTA */}
        <div className="px-5 py-4">
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <button
            onClick={handleBuy}
            disabled={!selected || loading}
            className="w-full btn-gold disabled:opacity-40"
          >
            {loading ? 'Opening checkout…' : selected
              ? `Purchase ${selected.label} — ${formatUSD(selected.price_cents)}`
              : 'Select a package'}
          </button>
          {selected && (
            <p className="text-center text-[10px] text-arc-muted mt-2">
              {formatGold(selected.gold)} Gold will be added to your balance after payment
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
