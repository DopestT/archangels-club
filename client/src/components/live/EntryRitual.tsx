import React, { useEffect, useState } from 'react';

interface Props {
  creatorName: string;
  goldBalance?: number;
  onComplete: () => void;
}

type Stage = 'entering' | 'private' | 'balance' | 'done';

const STAGE_DURATION: Record<Stage, number> = {
  entering: 1100,
  private:  1000,
  balance:  900,
  done:     0,
};

export default function EntryRitual({ creatorName, goldBalance, onComplete }: Props) {
  const [stage, setStage] = useState<Stage>('entering');
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Fade in immediately
    const t0 = setTimeout(() => setVisible(true), 50);

    let elapsed = 0;
    const stages: Stage[] = ['entering', 'private', 'balance'];
    let timer: ReturnType<typeof setTimeout>;

    function advance(idx: number) {
      const s = stages[idx];
      setStage(s);
      elapsed += STAGE_DURATION[s];
      if (idx + 1 < stages.length) {
        timer = setTimeout(() => advance(idx + 1), STAGE_DURATION[s]);
      } else {
        timer = setTimeout(() => {
          setLeaving(true);
          setTimeout(onComplete, 700);
        }, STAGE_DURATION[s]);
      }
    }

    const t1 = setTimeout(() => advance(0), 300);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(timer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at center, #0d0d0f 0%, #000 100%)',
        opacity: leaving ? 0 : visible ? 1 : 0,
        transition: leaving ? 'opacity 700ms ease-in' : 'opacity 500ms ease-out',
      }}
    >
      {/* Ambient gold glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(212,175,55,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-6 text-center px-8">
        {/* Crown mark */}
        <div
          style={{
            width: 2,
            height: 32,
            background: 'linear-gradient(180deg, transparent, #d4af37, transparent)',
            opacity: visible ? 1 : 0,
            transition: 'opacity 800ms ease',
          }}
        />

        {/* Stage text */}
        <div className="space-y-2 min-h-[72px] flex flex-col items-center justify-center">
          <p
            key={stage}
            className="text-white font-serif tracking-[0.18em] text-lg"
            style={{
              opacity: 1,
              animation: 'ritualFadeUp 0.55s ease forwards',
            }}
          >
            {stage === 'entering' && 'Entering the Room…'}
            {stage === 'private'  && 'Private by Design'}
            {stage === 'balance'  && (
              <>
                <span className="text-zinc-500 text-sm tracking-widest uppercase font-sans block mb-1">Gold Balance</span>
                <span style={{ color: '#d4af37' }}>
                  {goldBalance !== undefined ? goldBalance.toLocaleString() : '—'}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Bottom line */}
        <div
          style={{
            width: 48,
            height: 1,
            background: 'linear-gradient(90deg, transparent, #d4af37, transparent)',
            opacity: visible ? 0.5 : 0,
            transition: 'opacity 1000ms ease 400ms',
          }}
        />
      </div>

      <style>{`
        @keyframes ritualFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
