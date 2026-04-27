import React from 'react';

interface Props {
  label: string | null;
}

export default function ConfirmBadge({ label }: Props) {
  if (!label) return null;
  return (
    <span
      aria-live="polite"
      className="inline-flex items-center gap-1 text-xs text-gold font-sans whitespace-nowrap pointer-events-none"
      style={{ animation: 'arcConfirmIn 180ms cubic-bezier(.2,.8,.2,1) both' }}
    >
      <span style={{ fontSize: 11, lineHeight: 1 }}>✔</span>
      {label}
    </span>
  );
}
