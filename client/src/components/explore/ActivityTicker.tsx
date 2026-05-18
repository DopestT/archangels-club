import React, { useRef, useEffect, useState } from 'react';

export interface ActivityTickerItem {
  label: string;
  action: string;
}

interface ActivityTickerProps {
  mode: 'member' | 'creator';
  items?: ActivityTickerItem[];
}

const DOT = (
  <span
    aria-hidden
    style={{
      display: 'inline-block',
      width: 3,
      height: 3,
      borderRadius: '50%',
      background: 'rgba(212,175,55,0.4)',
      margin: '0 20px',
      verticalAlign: 'middle',
      flexShrink: 0,
    }}
  />
);

function TickerItem({ label, action }: ActivityTickerItem) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        fontSize: 11,
        letterSpacing: '0.01em',
        color: 'rgba(255,255,255,0.38)',
        flexShrink: 0,
      }}
    >
      <span style={{ color: 'rgba(212,175,55,0.7)', fontWeight: 500 }}>{label}</span>
      &nbsp;
      <span>{action}</span>
    </span>
  );
}

const SHELL_STYLE: React.CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.04)',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  background: 'rgba(255,255,255,0.012)',
  overflow: 'hidden',
  height: 30,
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
};

const LIVE_INDICATOR = (
  <div
    aria-hidden
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 72,
      display: 'flex',
      alignItems: 'center',
      paddingLeft: 12,
      gap: 5,
      zIndex: 3,
      background: 'linear-gradient(to right, #0A0A0F 45%, transparent 100%)',
      pointerEvents: 'none',
    }}
  >
    <span
      style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: '#22C55E',
        flexShrink: 0,
        animation: 'ticker-pulse 2.2s ease-in-out infinite',
      }}
    />
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.18em',
        color: 'rgba(255,255,255,0.28)',
        textTransform: 'uppercase',
      }}
    >
      Live
    </span>
    <style>{`
      @keyframes ticker-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
    `}</style>
  </div>
);

// Shown when items prop is explicitly [] — data-ready but no signals yet
function SignalsLoadingTicker() {
  return (
    <div style={SHELL_STYLE}>
      {LIVE_INDICATOR}
      <span
        style={{
          marginLeft: 110,
          fontSize: 10,
          color: 'rgba(255,255,255,0.2)',
          letterSpacing: '0.08em',
          fontStyle: 'italic',
          whiteSpace: 'nowrap',
        }}
      >
        Pulse active · Activity signals loading
      </span>
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
    </div>
  );
}

export default function ActivityTicker({ mode, items }: ActivityTickerProps) {
  // items=undefined → use mode-based content (legacy path until real API flows)
  // items=[]        → show "signals loading" state (data-ready, no events yet)
  // items=[...]     → use real data

  if (items !== undefined && items.length === 0) {
    return <SignalsLoadingTicker />;
  }

  const displayItems: ActivityTickerItem[] = items ?? (
    mode === 'creator'
      ? [
          { label: 'Studio Intelligence',  action: 'is tracking your signals' },
          { label: 'Signal updates',       action: 'will appear here in real time' },
          { label: 'Creator Pulse',        action: 'active and monitoring' },
          { label: 'Real-time activity',   action: 'streams when members interact' },
        ]
      : [
          { label: 'Signal Intelligence',  action: 'is active on this platform' },
          { label: 'Platform activity',    action: 'streams here in real time' },
          { label: 'Archangels Club',      action: 'live and monitoring' },
          { label: 'Creator signals',      action: 'update continuously' },
        ]
  );

  return <ScrollingTicker mode={mode} items={displayItems} />;
}

function ScrollingTicker({ mode, items }: { mode: string; items: ActivityTickerItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    if (trackRef.current) {
      setTrackWidth(trackRef.current.scrollWidth / 2);
    }
  }, [mode, items]);

  const single = items.flatMap((item, i) => [
    <TickerItem key={`a-${i}`} label={item.label} action={item.action} />,
    <React.Fragment key={`dot-a-${i}`}>{DOT}</React.Fragment>,
  ]);
  const doubled = [
    ...single,
    ...items.flatMap((item, i) => [
      <TickerItem key={`b-${i}`} label={item.label} action={item.action} />,
      <React.Fragment key={`dot-b-${i}`}>{DOT}</React.Fragment>,
    ]),
  ];

  return (
    <div style={SHELL_STYLE}>
      {LIVE_INDICATOR}

      {/* Left fade — behind LIVE indicator */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 72,
          top: 0,
          bottom: 0,
          width: 32,
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
          paddingLeft: 104,
        }}
      >
        {doubled}
      </div>

      <style>{`
        @keyframes arc-ticker-${mode} {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-${trackWidth}px); }
        }
        @keyframes ticker-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
