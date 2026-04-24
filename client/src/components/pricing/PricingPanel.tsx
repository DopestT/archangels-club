import React, { useState } from 'react';
import {
  Eye, Lock, Crown, TrendingUp, Flame, Diamond, Zap,
  Clock, Users, Package, Info, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { AccessType, PricingConfig } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface Props {
  config: PricingConfig;
  onChange: (config: PricingConfig) => void;
}

function set<K extends keyof PricingConfig>(config: PricingConfig, onChange: Props['onChange'], key: K, val: PricingConfig[K]) {
  onChange({ ...config, [key]: val });
}

// ─── Price tier guidance ──────────────────────────────────────────────────────

const TIERS = [
  { id: 'quick',   label: 'Quick Unlock',  range: '$3–$7',   min: 3,  max: 7,  conversion: '~58%', icon: <Zap className="w-3.5 h-3.5" />,     color: 'text-green-400',  bg: 'bg-green-400/10', border: 'border-green-400/25' },
  { id: 'standard',label: 'Standard',      range: '$10–$20', min: 10, max: 20, conversion: '~38%', icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-blue-400',   bg: 'bg-blue-400/10',  border: 'border-blue-400/25' },
  { id: 'premium', label: 'Premium',        range: '$25–$50', min: 25, max: 50, conversion: '~18%', icon: <Flame className="w-3.5 h-3.5" />,     color: 'text-amber-400',  bg: 'bg-amber-400/10', border: 'border-amber-400/25' },
  { id: 'exclusive',label:'Exclusive',      range: '$50+',    min: 50, max: Infinity, conversion: '~7%', icon: <Diamond className="w-3.5 h-3.5" />, color: 'text-violet-400', bg: 'bg-violet-400/10',border: 'border-violet-400/25' },
] as const;

function getPriceTier(price: number) {
  if (price >= 50) return TIERS[3];
  if (price >= 25) return TIERS[2];
  if (price >= 10) return TIERS[1];
  return TIERS[0];
}

// ─── Access type selector ─────────────────────────────────────────────────────

const ACCESS: { id: AccessType; icon: React.ReactNode; label: string; desc: string }[] = [
  { id: 'free',        icon: <Eye className="w-4 h-4" />,    label: 'Free Preview',         desc: 'Public teaser — drives discovery.' },
  { id: 'locked',      icon: <Lock className="w-4 h-4" />,   label: 'Pay to Unlock',        desc: 'Single payment for permanent access.' },
  { id: 'subscribers', icon: <Crown className="w-4 h-4" />,  label: 'Subscribers Only',     desc: 'Exclusive to active subscribers.' },
];

// ─── PricingPanel ─────────────────────────────────────────────────────────────

export default function PricingPanel({ config, onChange }: Props) {
  const [showGuide, setShowGuide] = useState(true);
  const [showBundle, setShowBundle] = useState(false);

  const price = isNaN(config.price) ? 0 : config.price;
  const net = price * 0.8;
  const activeTier = getPriceTier(price);
  const subDiscountedPrice = price * (1 - config.subscriberDiscountPct / 100);

  return (
    <div className="card-surface p-6 rounded-xl space-y-6">
      <h3 className="font-serif text-lg text-white">Pricing &amp; Distribution</h3>

      {/* Access Type */}
      <div>
        <label className="block text-xs text-arc-secondary mb-2">Access Type</label>
        <div className="space-y-2">
          {ACCESS.map(({ id, icon, label, desc }) => (
            <button
              key={id}
              onClick={() => set(config, onChange, 'accessType', id)}
              className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                config.accessType === id
                  ? 'bg-gold-muted border-gold'
                  : 'border-white/10 hover:border-gold/30 hover:bg-bg-hover'
              }`}
            >
              <span className={`mt-0.5 ${config.accessType === id ? 'text-gold' : 'text-arc-muted'}`}>{icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${config.accessType === id ? 'text-gold' : 'text-white'}`}>{label}</p>
                <p className="text-xs text-arc-muted mt-0.5">{desc}</p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                config.accessType === id ? 'border-gold bg-gold' : 'border-white/20'
              }`}>
                {config.accessType === id && <div className="w-1.5 h-1.5 rounded-full bg-bg-primary" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Unlock Price */}
      {config.accessType === 'locked' && (
        <div>
          <label className="block text-xs text-arc-secondary mb-1.5">Unlock Price (USD)</label>
          <div className="relative mb-3">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-arc-muted text-sm">$</span>
            <input
              type="number"
              value={config.price || ''}
              onChange={(e) => set(config, onChange, 'price', parseFloat(e.target.value) || 0)}
              min="1"
              step="0.01"
              placeholder="0.00"
              className="input-dark pl-8 text-base"
            />
          </div>

          {/* Payout line */}
          {price > 0 && (
            <div className="flex items-center gap-4 text-xs mb-4">
              <span className="text-arc-muted">You receive <span className="text-arc-success font-medium">{formatCurrency(net)}</span></span>
              <span className="text-arc-muted">Fee <span className="text-arc-secondary">{formatCurrency(price * 0.2)}</span></span>
            </div>
          )}

          {/* Price Guide */}
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5 text-xs text-arc-muted hover:text-gold transition-colors mb-2"
          >
            <Info className="w-3.5 h-3.5" />
            Price Guide
            {showGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showGuide && (
            <div className="rounded-xl border border-white/8 overflow-hidden">
              {TIERS.map((tier, i) => {
                const isActive = tier.id === activeTier.id;
                return (
                  <div
                    key={tier.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-all ${
                      i < TIERS.length - 1 ? 'border-b border-white/5' : ''
                    } ${isActive ? 'bg-gold-muted/50' : 'hover:bg-white/2'}`}
                  >
                    <span className={tier.color}>{tier.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-arc-secondary'}`}>{tier.label}</span>
                        {isActive && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/20 text-gold font-bold">YOUR PRICE</span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-mono ${isActive ? 'text-gold' : 'text-arc-muted'}`}>{tier.range}</span>
                    <span className={`text-xs w-12 text-right ${isActive ? 'text-arc-success' : 'text-arc-muted'}`}>{tier.conversion}</span>
                  </div>
                );
              })}
              <div className="px-4 py-2.5 bg-white/2 border-t border-white/5">
                <p className="text-xs text-arc-muted">
                  💡 <strong className="text-white">$15–$20</strong> delivers the best balance of conversion rate and revenue per unlock.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subscription Price */}
      {config.accessType === 'subscribers' && (
        <div>
          <label className="block text-xs text-arc-secondary mb-1.5">Monthly Subscription Price</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-arc-muted text-sm">$</span>
            <input
              type="number"
              value={config.price || ''}
              onChange={(e) => set(config, onChange, 'price', parseFloat(e.target.value) || 0)}
              min="4.99"
              step="0.01"
              placeholder="19.99"
              className="input-dark pl-8"
            />
          </div>
          {price > 0 && (
            <p className="text-xs text-arc-muted mt-1.5">
              You receive <span className="text-arc-success">{formatCurrency(price * 0.8)}/mo</span> per active subscriber.
            </p>
          )}
        </div>
      )}

      {/* Scarcity */}
      {config.accessType !== 'free' && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-arc-secondary">Scarcity &amp; Availability</p>

          {/* Limited unlocks */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                checked={config.maxUnlocks !== null}
                onChange={(e) => set(config, onChange, 'maxUnlocks', e.target.checked ? 100 : null)}
                className="accent-gold"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-sm text-white">Limit total unlocks</span>
              </div>
              {config.maxUnlocks !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    value={config.maxUnlocks}
                    onChange={(e) => set(config, onChange, 'maxUnlocks', Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    className="input-dark w-24 text-sm"
                  />
                  <span className="text-xs text-arc-muted">maximum unlocks</span>
                </div>
              )}
              {config.maxUnlocks !== null && (
                <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  Limited availability — increases perceived exclusivity
                </p>
              )}
            </div>
          </label>

          {/* Time limited */}
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                checked={config.availableUntil !== null}
                onChange={(e) => {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  set(config, onChange, 'availableUntil', e.target.checked ? d.toISOString().slice(0, 16) : null);
                }}
                className="accent-gold"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-gold" />
                <span className="text-sm text-white">Time-limited availability</span>
              </div>
              {config.availableUntil !== null && (
                <input
                  type="datetime-local"
                  value={config.availableUntil}
                  onChange={(e) => set(config, onChange, 'availableUntil', e.target.value)}
                  className="input-dark text-sm mt-2 w-full"
                />
              )}
            </div>
          </label>
        </div>
      )}

      {/* Subscriber Discount */}
      {config.accessType === 'locked' && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-3.5 h-3.5 text-gold" />
            <p className="text-xs font-medium text-arc-secondary">Subscriber Discount</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={50}
              step={5}
              value={config.subscriberDiscountPct}
              onChange={(e) => set(config, onChange, 'subscriberDiscountPct', Number(e.target.value))}
              className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
              style={{
                accentColor: '#D4AF37',
                background: `linear-gradient(to right, #D4AF37 ${config.subscriberDiscountPct * 2}%, rgba(255,255,255,0.08) ${config.subscriberDiscountPct * 2}%)`,
              }}
            />
            <span className="text-sm font-mono text-gold w-10 text-right">{config.subscriberDiscountPct}%</span>
          </div>
          {config.subscriberDiscountPct > 0 && price > 0 && (
            <p className="text-xs text-arc-muted mt-1.5">
              Subscribers pay <span className="text-arc-success">{formatCurrency(subDiscountedPrice)}</span>
              {' '}instead of {formatCurrency(price)}
            </p>
          )}
          {config.subscriberDiscountPct === 0 && (
            <p className="text-xs text-arc-muted mt-1.5">Offer a discount to reward your subscribers.</p>
          )}
        </div>
      )}

      {/* Bundle */}
      {config.accessType !== 'free' && (
        <div>
          <button
            onClick={() => {
              setShowBundle(!showBundle);
              set(config, onChange, 'bundleEnabled', !config.bundleEnabled);
            }}
            className="flex items-center gap-2 w-full text-left group"
          >
            <Package className="w-3.5 h-3.5 text-gold" />
            <span className="text-xs font-medium text-arc-secondary group-hover:text-white transition-colors">Bundle Option</span>
            <div className={`ml-auto w-8 h-4 rounded-full transition-all duration-200 ${config.bundleEnabled ? 'bg-gold' : 'bg-white/10'}`} style={{ position: 'relative' }}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-200 ${config.bundleEnabled ? 'left-4' : 'left-0.5'}`} style={{ position: 'absolute' }} />
            </div>
          </button>

          {config.bundleEnabled && (
            <div className="mt-4 space-y-3 pl-5 border-l border-gold/20">
              <div>
                <label className="block text-xs text-arc-secondary mb-1.5">Bundle Name</label>
                <input
                  type="text"
                  value={config.bundleName}
                  onChange={(e) => set(config, onChange, 'bundleName', e.target.value)}
                  placeholder="e.g. Premium Collection Vol. I"
                  className="input-dark text-sm"
                  maxLength={60}
                />
              </div>
              <div>
                <label className="block text-xs text-arc-secondary mb-1.5">Bundle Price</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-arc-muted text-sm">$</span>
                  <input
                    type="number"
                    value={config.bundlePrice ?? ''}
                    onChange={(e) => set(config, onChange, 'bundlePrice', parseFloat(e.target.value) || null)}
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    className="input-dark pl-8 text-sm"
                  />
                </div>
                {config.bundlePrice && price > 0 && config.bundlePrice < price && (
                  <p className="text-xs text-arc-success mt-1.5 flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    Bundle saves {formatCurrency(price - config.bundlePrice)} vs individual price
                  </p>
                )}
              </div>
              <p className="text-xs text-arc-muted leading-relaxed">
                Bundles group multiple pieces at a discount. Members see the savings clearly — bundles increase average order value by up to 35%.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
