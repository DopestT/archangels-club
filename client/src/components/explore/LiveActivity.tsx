import React, { useEffect, useRef, useState } from 'react';
import { Lock, Users, Zap } from 'lucide-react';
import type { Content } from '../../types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

interface RealEvent {
  ref_type: 'content' | 'subscription' | 'tip';
  content_title?: string;
  creator_name?: string;
  created_at: string;
}

interface ToastItem {
  id: number;
  icon: 'lock' | 'users' | 'zap';
  message: string;
  sub: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function buildPool(real: RealEvent[], content: Content[]): Omit<ToastItem, 'id'>[] {
  const pool: Omit<ToastItem, 'id'>[] = [];

  for (const e of real) {
    if (e.ref_type === 'content' && e.content_title) {
      pool.push({
        icon: 'lock',
        message: `Someone just unlocked "${e.content_title}"`,
        sub: timeAgo(e.created_at),
      });
    } else if (e.ref_type === 'subscription' && e.creator_name) {
      pool.push({
        icon: 'users',
        message: `A new member subscribed to ${e.creator_name}`,
        sub: timeAgo(e.created_at),
      });
    } else if (e.ref_type === 'tip' && e.creator_name) {
      pool.push({
        icon: 'zap',
        message: `Someone sent a tip to ${e.creator_name}`,
        sub: timeAgo(e.created_at),
      });
    }
  }

  // Fill to at least 8 items with simulated events from content
  const locked = content.filter((c) => c.access_type === 'locked' && c.title);
  const creators = [...new Set(content.map((c) => c.creator_name).filter(Boolean))] as string[];

  if (locked.length > 0) {
    for (let i = 0; pool.length < 8 && i < 20; i++) {
      const c = locked[Math.floor(Math.random() * locked.length)];
      const unlockCount = Number(c.unlock_count ?? 0);
      const variant = Math.floor(Math.random() * 3);

      if (variant === 0) {
        pool.push({ icon: 'lock', message: `Someone just unlocked "${c.title}"`, sub: 'just now' });
      } else if (variant === 1 && unlockCount > 2) {
        const n = Math.min(unlockCount, 2 + Math.floor(Math.random() * 4));
        pool.push({ icon: 'users', message: `${n} people unlocked "${c.title}" today`, sub: 'trending' });
      } else {
        pool.push({ icon: 'zap', message: `High demand — limited unlocks left`, sub: 'right now' });
      }
    }
  }

  if (creators.length > 0 && pool.length < 8) {
    for (let i = 0; pool.length < 8 && i < 10; i++) {
      const name = creators[Math.floor(Math.random() * creators.length)];
      const n = 1 + Math.floor(Math.random() * 4);
      pool.push({
        icon: 'users',
        message: `${n} ${n === 1 ? 'person' : 'people'} subscribed to ${name} today`,
        sub: 'today',
      });
    }
  }

  // Always have a fallback scarcity nudge
  if (pool.length === 0) {
    pool.push({ icon: 'zap', message: 'High demand — limited unlocks left', sub: 'right now' });
  }

  return pool;
}

interface Props {
  content: Content[];
}

type Phase = 'hidden' | 'enter' | 'visible' | 'exit';

export default function LiveActivity({ content }: Props) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const [phase, setPhase] = useState<Phase>('hidden');
  const poolRef = useRef<Omit<ToastItem, 'id'>[]>([]);
  const counterRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch real events and merge with simulated pool
  useEffect(() => {
    fetch(`${API_BASE}/api/activity/recent`)
      .then((r) => r.json())
      .then((data: RealEvent[]) => {
        const real = Array.isArray(data) ? data : [];
        poolRef.current = buildPool(real, content);
      })
      .catch(() => {
        poolRef.current = buildPool([], content);
      });
  }, [content]);

  // Rebuild simulated pool when content loads (real fetch may arrive first with empty content)
  useEffect(() => {
    if (content.length > 0 && poolRef.current.length < 3) {
      poolRef.current = buildPool([], content);
    }
  }, [content]);

  function showNext() {
    const pool = poolRef.current;
    if (pool.length === 0) {
      scheduleNext();
      return;
    }
    const item = pool[counterRef.current % pool.length];
    counterRef.current += 1;

    setToast({ ...item, id: counterRef.current });
    setPhase('enter');

    // enter → visible after 20ms (allows CSS transition to fire)
    timerRef.current = setTimeout(() => setPhase('visible'), 20);

    // visible → exit after 3.8s
    timerRef.current = setTimeout(() => setPhase('exit'), 3800);

    // exit → hidden after 400ms, then schedule next
    timerRef.current = setTimeout(() => {
      setPhase('hidden');
      setToast(null);
      scheduleNext();
    }, 4200);
  }

  function scheduleNext() {
    const delay = 5000 + Math.random() * 5000; // 5–10s
    timerRef.current = setTimeout(showNext, delay);
  }

  // Kick off after initial delay of 4–7s
  useEffect(() => {
    const init = 4000 + Math.random() * 3000;
    timerRef.current = setTimeout(showNext, init);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'hidden' || !toast) return null;

  const isEnter = phase === 'enter';
  const isExit = phase === 'exit';

  return (
    <div
      className="fixed bottom-6 left-5 z-50 max-w-[280px] pointer-events-none"
      style={{
        transition: 'opacity 350ms ease, transform 350ms ease',
        opacity: isEnter || isExit ? 0 : 1,
        transform: isEnter ? 'translateY(10px)' : isExit ? 'translateY(-6px)' : 'translateY(0)',
      }}
    >
      <div className="flex items-start gap-3 bg-bg-surface border border-white/10 rounded-2xl px-4 py-3 shadow-2xl"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,175,55,0.08)' }}
      >
        {/* Icon */}
        <div className={`flex-none w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
          toast.icon === 'lock' ? 'bg-gold/15 text-gold' :
          toast.icon === 'users' ? 'bg-emerald-500/15 text-emerald-400' :
          'bg-orange-500/15 text-orange-400'
        }`}>
          {toast.icon === 'lock' && <Lock className="w-3.5 h-3.5" />}
          {toast.icon === 'users' && <Users className="w-3.5 h-3.5" />}
          {toast.icon === 'zap' && <Zap className="w-3.5 h-3.5" />}
        </div>

        {/* Text */}
        <div className="min-w-0">
          <p className="text-xs text-white leading-snug font-medium">{toast.message}</p>
          <p className="text-[10px] text-arc-muted mt-0.5">{toast.sub}</p>
        </div>

        {/* Live dot */}
        <div className="flex-none mt-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
        </div>
      </div>
    </div>
  );
}
