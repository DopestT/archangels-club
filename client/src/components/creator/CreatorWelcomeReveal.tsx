import React, { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = (uid: string) => `arc_studio_welcomed_${uid}`;

interface Props {
  userId: string;
  firstName: string;
  isVerifiedCreator: boolean;
}

export default function CreatorWelcomeReveal({ userId, firstName, isVerifiedCreator }: Props) {
  const [phase, setPhase] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');

  useEffect(() => {
    if (!isVerifiedCreator) return;
    if (localStorage.getItem(STORAGE_KEY(userId)) === 'true') return;
    // Mount invisible, then trigger transition on next paint
    setPhase('entering');
    const t = setTimeout(() => setPhase('visible'), 40);
    return () => clearTimeout(t);
  }, [userId, isVerifiedCreator]);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY(userId), 'true');
    setPhase('exiting');
  }, [userId]);

  if (phase === 'hidden') return null;

  const visible = phase === 'visible';
  const exiting = phase === 'exiting';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to your creator studio"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#050507',
        opacity: visible ? 1 : 0,
        pointerEvents: exiting ? 'none' : 'auto',
        transition: exiting
          ? 'opacity 0.5s ease'
          : 'opacity 0.7s ease',
      }}
      onTransitionEnd={() => {
        if (exiting) setPhase('hidden');
      }}
    >
      {/* Ambient radial glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 65% 55% at 50% 44%, rgba(212,175,55,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Subtle corner vignette */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 55%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Content panel */}
      <div
        style={{
          position: 'relative',
          textAlign: 'center',
          maxWidth: '520px',
          width: '100%',
          padding: '0 40px',
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
          transition: 'transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Gold ornament */}
        <div
          aria-hidden="true"
          style={{
            fontFamily: 'serif',
            fontSize: '22px',
            color: '#D4AF37',
            opacity: 0.6,
            marginBottom: '28px',
            letterSpacing: '0.15em',
          }}
        >
          ✦ ✦ ✦
        </div>

        {/* Eyebrow */}
        <p
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: '#D4AF37',
            opacity: 0.85,
            marginBottom: '20px',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          Approved Creator
        </p>

        {/* Primary heading */}
        <h1
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(38px, 7vw, 60px)',
            fontWeight: 400,
            color: '#FFFFFF',
            lineHeight: 1.05,
            marginBottom: '12px',
            letterSpacing: '-0.01em',
          }}
        >
          Welcome, {firstName}.
        </h1>

        {/* Secondary heading */}
        <p
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(20px, 3.5vw, 28px)',
            fontWeight: 400,
            fontStyle: 'italic',
            color: '#D4AF37',
            marginBottom: '36px',
            opacity: 0.9,
          }}
        >
          Your studio awaits.
        </p>

        {/* Divider */}
        <div
          aria-hidden="true"
          style={{
            width: '44px',
            height: '1px',
            background: 'rgba(212,175,55,0.35)',
            margin: '0 auto 36px',
          }}
        />

        {/* Support copy */}
        <p
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '15px',
            color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.75,
            maxWidth: '380px',
            margin: '0 auto 48px',
          }}
        >
          Your creator workspace is now live. Upload drops, manage subscribers, track performance, and build your presence.
        </p>

        {/* CTA */}
        <button
          onClick={dismiss}
          className="btn-gold"
          style={{
            fontSize: '14px',
            letterSpacing: '0.06em',
            padding: '14px 48px',
            borderRadius: '12px',
          }}
        >
          Enter Studio
        </button>

        {/* Fine print */}
        <p
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.2)',
            marginTop: '24px',
            letterSpacing: '0.02em',
          }}
        >
          Archangels Club · Creator Studio
        </p>
      </div>
    </div>
  );
}
