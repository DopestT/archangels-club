import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Coins, ChevronRight, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useToast } from '../components/ui/Toast';

interface Persona {
  id: string;
  name: string;
  tagline: string;
  bio: string;
  avatar_url: string;
  tags: string[];
  goal_title: string;
  goal_gold: number;
  goal_progress: number;
  status: string;
}

interface GoldState {
  balance: number;
  starter_claimed: boolean;
}

export default function VirtualAngelsStudio() {
  const navigate = useNavigate();
  const toast = useToast();

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [gold, setGold] = useState<GoldState>({ balance: 0, starter_claimed: false });
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  const [claimingGold, setClaimingGold] = useState(false);

  const fetchPersonas = useCallback(async () => {
    try {
      const res = await apiFetch('/api/ai-personas');
      if (res.ok) {
        const data = await res.json();
        setPersonas(data.personas ?? data ?? []);
      }
    } catch {
      // personas stay empty
    } finally {
      setLoadingPersonas(false);
    }
  }, []);

  const fetchGold = useCallback(async () => {
    try {
      const res = await apiFetch('/api/gold/balance');
      if (res.ok) {
        const data = await res.json();
        setGold(g => ({ ...g, balance: data.balance ?? 0 }));
      }
    } catch {
      // gold stays 0
    }
  }, []);

  useEffect(() => {
    fetchPersonas();
    fetchGold();
  }, [fetchPersonas, fetchGold]);

  const claimStarter = async () => {
    setClaimingGold(true);
    try {
      const res = await apiFetch('/api/gold/claim-starter', { method: 'POST' });
      const data = await res.json();
      if (data.already_claimed) {
        toast.info('You already claimed your starter Gold.');
      } else {
        setGold(g => ({ ...g, balance: data.balance ?? g.balance, starter_claimed: true }));
        toast.success(`+${data.granted} Gold claimed! Welcome to the Studio.`);
      }
    } catch {
      toast.error('Could not claim Gold. Try again.');
    } finally {
      setClaimingGold(false);
    }
  };

  const goalPct = (p: Persona) =>
    p.goal_gold > 0 ? Math.min(100, Math.round((p.goal_progress / p.goal_gold) * 100)) : 0;

  return (
    <div className="min-h-screen bg-bg-primary px-4 pb-16 pt-6 md:px-6 lg:px-8">
      {/* Compliance banner */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-white/8 bg-bg-surface px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <p className="text-xs leading-relaxed text-arc-secondary">
          <span className="font-semibold text-white">18+ only.</span> All personas are fictional AI characters.
          No real person is represented. Virtual gifts are entertainment currency with no monetary value.{' '}
          <a href="/compliance" className="underline decoration-white/30 hover:text-white">Platform Rules</a>
        </p>
      </div>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-eyebrow mb-1">Virtual Angels Studio</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Choose Your Angel
          </h1>
          <p className="mt-1.5 text-sm text-arc-secondary">
            Intimate AI companions. Spend Gold. Light the Halo.
          </p>
        </div>

        {/* Gold wallet */}
        <div className="flex items-center gap-3 rounded-2xl border border-gold/20 bg-bg-surface px-5 py-3">
          <Coins className="h-5 w-5 text-gold" />
          <div>
            <p className="text-xs text-arc-muted">Gold Balance</p>
            <p className="text-lg font-semibold text-gold">{gold.balance.toLocaleString()} G</p>
          </div>
          {gold.balance === 0 && (
            <button
              onClick={claimStarter}
              disabled={claimingGold}
              className="btn-gold ml-2 py-2 px-4 text-xs"
            >
              {claimingGold ? 'Claiming…' : 'Claim 250 Free'}
            </button>
          )}
        </div>
      </div>

      {/* Persona grid */}
      {loadingPersonas ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-surface h-80 animate-pulse" />
          ))}
        </div>
      ) : personas.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <Sparkles className="h-10 w-10 text-gold/40" />
          <p className="text-lg font-medium text-white">Angels Coming Soon</p>
          <p className="text-sm text-arc-secondary">The Studio is being prepared. Check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {personas.map(p => (
            <PersonaCard key={p.id} persona={p} goalPct={goalPct(p)} onEnter={() => navigate(`/angels/${p.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonaCard({
  persona: p,
  goalPct,
  onEnter,
}: {
  persona: Persona;
  goalPct: number;
  onEnter: () => void;
}) {
  return (
    <div className="card-surface group flex flex-col overflow-hidden">
      {/* Avatar */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-bg-hover">
        {p.avatar_url ? (
          <img
            src={p.avatar_url}
            alt={p.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Sparkles className="h-12 w-12 text-gold/30" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {/* Name over avatar */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
          <p className="text-base font-semibold text-white">{p.name}</p>
          <p className="text-xs text-white/70">{p.tagline}</p>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Tags */}
        {p.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.tags.slice(0, 3).map(t => (
              <span key={t} className="tag-pill">{t}</span>
            ))}
          </div>
        )}

        {/* Room Goal */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-arc-secondary">{p.goal_title}</span>
            <span className="font-medium text-gold">{goalPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold to-gold/70 transition-all duration-700"
              style={{ width: `${goalPct}%` }}
            />
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onEnter}
          className="btn-gold mt-auto flex w-full items-center justify-center gap-2"
        >
          Enter Room <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
