/**
 * ABMIE-X Pulse Layer Preview — development only, no auth required.
 * Route: /preview/pulse
 */
import React from 'react';
import CoachingCard from '../components/pulse/CoachingCard';
import RecommendationCard from '../components/pulse/RecommendationCard';
import RecommendationStrip from '../components/pulse/RecommendationStrip';
import PulseStatusPanel from '../components/pulse/PulseStatusPanel';
import type { RecommendationCardProps } from '../components/pulse/RecommendationCard';

const MOCK_TX = [
  { created_at: new Date(Date.now() - 2 * 3600000).toISOString(), amount: 25 },
  { created_at: new Date(Date.now() - 5 * 3600000).toISOString(), amount: 12 },
  { created_at: new Date(Date.now() - 8 * 3600000).toISOString(), amount: 15 },
  { created_at: new Date(Date.now() - 25 * 3600000).toISOString(), amount: 8 },
];

// Real-looking recs for preview only — these represent what Claude A/B will return
const PREVIEW_RECS: RecommendationCardProps[] = [
  {
    signal: 'picked-for-you',
    title: 'Noire Atelier — Vol. III',
    creator: 'Noire Atelier',
    reason: 'Matches your unlock pattern',
    price: 12,
    confidence: 'high',
    suggestedAction: 'Unlock now',
    to: '#',
  },
  {
    signal: 'most-collected',
    title: 'Cipher Series — Ltd. Run',
    creator: 'Solène V.',
    reason: '47 members this week',
    price: 25,
    confidence: 'high',
    to: '#',
  },
  {
    signal: 'trending-tonight',
    title: 'The Velvet Archive',
    creator: 'Maison Obscure',
    reason: 'Moving fast right now',
    price: 15,
    confidence: 'medium',
    to: '#',
  },
  {
    signal: 'similar-to-vault',
    title: 'Dusk Protocol — Vol. 1',
    creator: 'Aria Nocturne',
    reason: 'Tone matches what you own',
    price: 8,
    confidence: 'high',
    suggestedAction: 'View drop',
    to: '#',
  },
  {
    signal: 'new-creator-discovery',
    title: 'Margaux Veil',
    creator: 'First drop live',
    reason: 'New creator — just approved',
    confidence: 'medium',
    to: '#',
  },
  {
    signal: 'subscriber-opportunity',
    title: 'Obsidian Studio',
    creator: 'Limited slots open',
    reason: 'Subscriber cap not yet reached',
    suggestedAction: 'Subscribe',
    to: '#',
  },
  {
    signal: 'recently-active',
    title: 'Solène V.',
    creator: '3 new drops',
    reason: 'Published yesterday',
    to: '#',
  },
  {
    signal: 'custom-requests-open',
    title: 'Maison Obscure',
    creator: 'Taking requests',
    reason: 'Custom work available now',
    suggestedAction: 'Send request',
    to: '#',
  },
];

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-white/6" />
        <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-arc-muted flex-shrink-0">{label}</p>
        <div className="h-px flex-1 bg-white/6" />
      </div>
      {children}
    </section>
  );
}

export default function PulsePreview() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div
        className="relative overflow-hidden pt-12 pb-8 mb-10 border-b border-white/5"
        style={{ background: 'radial-gradient(ellipse at 50% -5%, rgba(212,175,55,0.12) 0%, transparent 60%)' }}
      >
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-[9px] font-bold tracking-[0.22em] uppercase text-arc-muted mb-2">ABMIE-X · Pulse Layer</p>
          <h1 className="font-serif text-3xl text-white mb-1">Premium Presentation Layer</h1>
          <p className="text-arc-secondary text-sm">Visual component preview — Claude C delivery</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-20">

        {/* ── Pulse Status Panel ────────────────────────────────────────────── */}
        <Section label="Pulse Status Panel — Admin Command Center">
          <div className="space-y-4">
            <PulseStatusPanel
              transactions={MOCK_TX}
              accessRequests={[{ id: '1' }, { id: '2' }, { id: '3' }] as any}
              reports={[{ id: '1' }] as any}
              creators={[{ id: '1' }, { id: '2' }] as any}
              content={[{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }] as any}
            />
            <p className="text-[10px] text-arc-muted italic">↑ Elevated state — queues active</p>

            <PulseStatusPanel
              transactions={MOCK_TX}
              accessRequests={[]}
              reports={[]}
              creators={[]}
              content={[]}
            />
            <p className="text-[10px] text-arc-muted italic">↑ Clear state — all queues empty</p>

            <PulseStatusPanel
              transactions={MOCK_TX}
              accessRequests={[{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }] as any}
              reports={[{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }] as any}
              creators={[{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }] as any}
              content={[{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }, { id: '7' }, { id: '8' }, { id: '9' }] as any}
            />
            <p className="text-[10px] text-arc-muted italic">↑ Critical state — all queues over threshold</p>
          </div>
        </Section>

        {/* ── Recommendation Strip States ───────────────────────────────────── */}
        <Section label="Signal Intelligence — Recommendation Strip States">
          <div className="space-y-10">

            {/* Loading */}
            <div>
              <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-arc-muted/60 mb-3">Loading</p>
              <RecommendationStrip recommendations={[]} loading={true} />
            </div>

            {/* Empty cold — 0 unlocks */}
            <div>
              <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-arc-muted/60 mb-3">Empty — Cold (0 unlocks)</p>
              <div
                className="rounded-xl border border-white/6 p-4"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <RecommendationStrip recommendations={[]} loading={false} unlockedCount={0} />
              </div>
            </div>

            {/* Empty warm — has unlocks, no recs yet */}
            <div>
              <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-arc-muted/60 mb-3">Empty — Warm (has unlocks, no recs yet)</p>
              <div
                className="rounded-xl border border-white/6 p-4"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <RecommendationStrip recommendations={[]} loading={false} unlockedCount={3} />
              </div>
            </div>

            {/* Active — high confidence, fresh */}
            <div>
              <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-arc-muted/60 mb-3">Active — High Confidence · Fresh Signal</p>
              <RecommendationStrip
                recommendations={PREVIEW_RECS}
                loading={false}
                confidence="high"
                freshness="fresh"
              />
            </div>

            {/* Active — medium confidence, stale */}
            <div>
              <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-arc-muted/60 mb-3">Active — Medium Confidence · Stale Signal</p>
              <RecommendationStrip
                recommendations={PREVIEW_RECS.slice(0, 4)}
                loading={false}
                confidence="medium"
                freshness="stale"
              />
            </div>

            {/* Active — low confidence, fallback */}
            <div>
              <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-arc-muted/60 mb-3">Active — Low Confidence · Fallback (platform trends)</p>
              <RecommendationStrip
                recommendations={PREVIEW_RECS.slice(2, 6)}
                loading={false}
                confidence="low"
                freshness="fallback"
              />
            </div>
          </div>
        </Section>

        {/* ── All 9 Signal Cards ────────────────────────────────────────────── */}
        <Section label="Signal Card Library — All 9 Types">
          <div className="flex flex-wrap gap-3">
            {PREVIEW_RECS.map((rec, i) => (
              <RecommendationCard key={i} {...rec} revealDelay={i * 40} />
            ))}
          </div>
        </Section>

        {/* ── Coaching Cards ────────────────────────────────────────────────── */}
        <Section label="Studio Intelligence — Creator Coaching Cards">
          <div className="space-y-3 max-w-2xl">
            <CoachingCard
              issue="No unlocks yet"
              reason="3 drops live — zero unlocks. Entry price may be causing friction."
              action="Start at $5 to build your first unlock history. Raise prices on future drops once you have 10+ unlocks."
              confidence="high"
              actionLabel="Review Pricing"
              actionTo="/creator/media"
              variant="opportunity"
            />
            <CoachingCard
              issue="2 requests waiting 48h+"
              reason="Custom requests go cold after 72 hours. Late responses convert at a fraction of the rate."
              action="Accept or decline within 24 hours — fans who ask are already warm buyers."
              confidence="high"
              actionLabel="View Requests"
              actionTo="/messages"
              variant="warning"
            />
            <CoachingCard
              issue="Low profile traffic"
              reason="Fewer than 5 profile views this week. Drops can't convert visitors they don't have."
              action="Share your profile link or create a tracked invite link to find out where your audience lives."
              confidence="medium"
              actionLabel="Share Profile"
              actionTo="/creator"
              variant="info"
            />
            <CoachingCard
              issue="Loading signal..."
              reason=""
              action=""
              confidence="medium"
              actionLabel=""
              variant="info"
              loading={true}
            />
          </div>
        </Section>

        {/* ── Pulse Layer colour reference ──────────────────────────────────── */}
        <Section label="Pulse Layer — Signal Colour System">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Clear',    dot: 'bg-arc-success',  border: 'border-arc-success/25', bg: 'rgba(34,197,94,0.06)'   },
              { label: 'Elevated', dot: 'bg-amber-400',     border: 'border-amber-400/25',   bg: 'rgba(251,191,36,0.06)'  },
              { label: 'Critical', dot: 'bg-arc-error',     border: 'border-arc-error/30',   bg: 'rgba(239,68,68,0.06)'   },
              { label: 'Gold',     dot: 'bg-gold',          border: 'border-gold/25',         bg: 'rgba(212,175,55,0.06)'  },
            ].map(({ label, dot, border, bg }) => (
              <div key={label} className={`rounded-xl border p-4 ${border}`} style={{ background: bg }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-arc-muted">{label}</span>
                </div>
                <p className="font-serif text-xl text-white">Signal</p>
                <p className="text-[10px] text-arc-muted mt-1">Status indicator</p>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}
