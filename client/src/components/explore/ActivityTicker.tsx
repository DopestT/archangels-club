import React, { useRef, useEffect, useState } from 'react';

interface ActivityTickerProps {
  mode: 'member' | 'creator';
}

const MEMBER_ITEMS = [
  { label: 'Noire Atelier', action: 'drop unlocked 42 times today' },
  { label: '3 limited drops', action: 'ending in the next 24 hours' },
  { label: 'Solène V.', action: 'just released a new locked post' },
  { label: 'The Dark Room bundle', action: 'is trending right now' },
  { label: '18 members', action: 'joined the platform this week' },
  { label: 'Cipher Series', action: 'sold out its last 4 spots' },
  { label: '9 new drops', action: 'added by creators this morning' },
  { label: 'Vault III', action: 'claimed by 11 subscribers today' },
];

const CREATOR_ITEMS = [
  { label: 'Obsidian Series', action: 'gained 8 unlocks in the last hour' },
  { label: '3 visitors', action: 'are close to subscribing to your profile' },
  { label: 'Your limited drop', action: 'is 67% claimed — trending now' },
  { label: 'Bundle conversion rate', action: 'is up 18% today' },
  { label: 'Subscribers on the platform', action: 'up 12% this week' },
  { label: 'Your last drop', action: 'earned the most in the past 30 days' },
  { label: '4 saves', action: 'on your latest post in the last hour' },
  { label: 'Top creators', action: 'averaging 6 drops per month' },
];

const DOT = (
  <span
    aria-hidden
    style={{
      display: 'inline-block',
      width: 3,
      height: 3,
      borderRadius: '50%',
      background: 'rgba(212,175,55,0.45)',
      margin: '0 20px',
      verticalAlign: 'middle',
      flexShrink: 0,
    }}
  />
);

function TickerItem({ label, action }: { label: string; action: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        fontSize: 11,
        letterSpacing: '0.01em',
        color: 'rgba(255,255,255,0.42)',
        flexShrink: 0,
      }}
    >
      <span style={{ color: 'rgba(212,175,55,0.75)', fontWeight: 500 }}>{label}</span>
      &nbsp;
      <span>{action}</span>
    </span>
  );
}

export default function ActivityTicker({ mode }: ActivityTickerProps) {
  const items = mode === 'creator' ? CREATOR_ITEMS : MEMBER_ITEMS;
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  // Measure the natural width of one copy so we can set the animation distance exactly
  useEffect(() => {
    if (trackRef.current) {
      setTrackWidth(trackRef.current.scrollWidth / 2);
    }
  }, [mode]);

  // Build one copy, then duplicate it for seamless loop
  const single = items.flatMap((item, i) => [
    <TickerItem key={`a-${i}`} label={item.label} action={item.action} />,
    <React.Fragment key={`dot-a-${i}`}>{DOT}</React.Fragment>,
  ]);
  const doubled = [...single, ...items.flatMap((item, i) => [
    <TickerItem key={`b-${i}`} label={item.label} action={item.action} />,
    <React.Fragment key={`dot-b-${i}`}>{DOT}</React.Fragment>,
  ])];

  return (
    <div
      style={{
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(255,255,255,0.015)',
        overflow: 'hidden',
        height: 30,
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {/* Left fade */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 48,
          background: 'linear-gradient(to right, #0A0A0F 0%, transparent 100%)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />

      {/* Right fade */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 48,
          background: 'linear-gradient(to left, #0A0A0F 0%, transparent 100%)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />

      {/* Scrolling track */}
      <div
        ref={trackRef}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          willChange: 'transform',
          animation: trackWidth > 0
            ? `arc-ticker-${mode} ${Math.round(trackWidth / 28)}s linear infinite`
            : undefined,
          paddingLeft: 24,
        }}
      >
        {doubled}
      </div>

      <style>{`
        @keyframes arc-ticker-${mode} {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-${trackWidth}px); }
        }
      `}</style>
    </div>
  );
}
