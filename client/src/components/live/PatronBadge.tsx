import React from 'react';

// TODO(patron-levels): Patron tier thresholds should be configurable per-creator
// or platform-wide via an admin setting. These are platform defaults.
export const PATRON_TIERS = [
  { label: 'Bronze',   minCents: 100,   color: 'text-amber-700'  },
  { label: 'Silver',   minCents: 1000,  color: 'text-zinc-300'   },
  { label: 'Gold',     minCents: 5000,  color: 'text-yellow-400' },
  { label: 'Platinum', minCents: 20000, color: 'text-blue-300'   },
  { label: 'Angel',    minCents: 100000, color: 'text-purple-400' },
] as const;

export function getPatronTier(totalCents: number) {
  for (let i = PATRON_TIERS.length - 1; i >= 0; i--) {
    if (totalCents >= PATRON_TIERS[i].minCents) return PATRON_TIERS[i];
  }
  return null;
}

interface Props {
  totalSpentCents: number;
  className?: string;
}

export default function PatronBadge({ totalSpentCents, className = '' }: Props) {
  const tier = getPatronTier(totalSpentCents);
  if (!tier) return null;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-full border border-current/20 ${tier.color} ${className}`}>
      {tier.label}
    </span>
  );
}
