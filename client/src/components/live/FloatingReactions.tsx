import React, { useState, useCallback } from 'react';
import { Heart } from 'lucide-react';

interface FlyHeart { id: number; x: number; delay: number; }

let _uid = 0;

export default function FloatingReactions() {
  const [hearts, setHearts] = useState<FlyHeart[]>([]);

  const pop = useCallback(() => {
    const count = Math.floor(Math.random() * 3) + 2;
    const batch: FlyHeart[] = Array.from({ length: count }, (_, i) => ({
      id: _uid++,
      x: Math.round(Math.random() * 44 - 22),
      delay: i * 90,
    }));
    setHearts(h => [...h, ...batch]);
    setTimeout(() => {
      const ids = new Set(batch.map(b => b.id));
      setHearts(h => h.filter(x => !ids.has(x.id)));
    }, 2400);
  }, []);

  return (
    <div
      className="absolute bottom-14 right-4 pointer-events-none"
      style={{ zIndex: 40, width: 52, height: 200 }}
    >
      {/* Floating hearts */}
      {hearts.map(h => (
        <div
          key={h.id}
          className="absolute"
          style={{
            bottom: 52,
            left: `calc(50% + ${h.x}px - 11px)`,
            animationDelay: `${h.delay}ms`,
            animation: 'floatUp 2.2s ease-out forwards',
          }}
        >
          <Heart size={22} fill="#ef4444" color="#ef4444" />
        </div>
      ))}

      {/* React button */}
      <button
        onClick={pop}
        className="pointer-events-auto absolute bottom-0 left-0 right-0 mx-auto w-12 h-12 flex items-center justify-center rounded-full transition-transform active:scale-90 select-none"
        style={{
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.15)',
          backdropFilter: 'blur(8px)',
        }}
        title="React"
      >
        <Heart size={22} fill="#ef4444" color="#ef4444" />
      </button>
    </div>
  );
}
