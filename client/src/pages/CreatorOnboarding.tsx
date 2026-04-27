import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowLeft, Check, X, Zap, TrendingUp, Diamond,
  Camera, Video, Package, Lock, Eye, Upload, Sparkles,
  Crown, ChevronRight, User, DollarSign, Play, Clock, Image,
  Mic, FileText, Layers,
} from 'lucide-react';

// ─── Step: Welcome ────────────────────────────────────────────────────────────

function StepWelcome({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.13) 0%, transparent 65%)' }}
    >
      <div className="mb-10 max-w-sm">
        <div className="w-20 h-20 rounded-full border border-gold/30 bg-gold/8 flex items-center justify-center mx-auto mb-8">
          <Crown className="w-9 h-9 text-gold" />
        </div>
        <p className="section-eyebrow mb-4">Creator Training</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-white mb-5 leading-tight">
          You've been selected.<br />Let's get you earning.
        </h1>
        <p className="text-arc-secondary leading-relaxed">
          A quick walkthrough covering what content performs, how to price it, and how to publish your first post — in under 5 minutes.
        </p>
      </div>
      <div className="w-full max-w-xs space-y-3">
        <button onClick={onNext} className="btn-gold w-full py-3.5 text-base">
          Start Training
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={onSkip}
          className="w-full py-2.5 text-sm text-arc-muted hover:text-white transition-colors"
        >
          Skip — take me to Creator Studio
        </button>
      </div>
    </div>
  );
}

// ─── Step: Content Category ───────────────────────────────────────────────────

function StepContentCategory({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  const categories = [
    { id: 'photos', label: 'Photos', sub: 'Photo sets and galleries', icon: <Camera className="w-6 h-6" />, color: 'text-gold', ring: 'border-gold/30 bg-gold/8' },
    { id: 'video', label: 'Video', sub: 'Short clips and scenes', icon: <Video className="w-6 h-6" />, color: 'text-violet-400', ring: 'border-violet-400/30 bg-violet-400/8' },
    { id: 'audio', label: 'Audio', sub: 'Spoken word and sound', icon: <Mic className="w-6 h-6" />, color: 'text-blue-400', ring: 'border-blue-400/30 bg-blue-400/8' },
    { id: 'editorial', label: 'Editorial', sub: 'Written pieces and stories', icon: <FileText className="w-6 h-6" />, color: 'text-rose-400', ring: 'border-rose-400/30 bg-rose-400/8' },
    { id: 'mixed', label: 'Mixed', sub: 'A bit of everything', icon: <Layers className="w-6 h-6" />, color: 'text-arc-secondary', ring: 'border-white/15 bg-white/4' },
  ];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.1) 0%, transparent 60%)' }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="section-eyebrow mb-3">Creator Setup</p>
          <h2 className="font-serif text-3xl sm:text-4xl text-white mb-3">What will you create?</h2>
          <p className="text-arc-secondary text-sm">We'll tailor your training to what you're making.</p>
        </div>

        <div className="space-y-2.5 mb-8">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelected(cat.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-200 ${
                selected === cat.id
                  ? `${cat.ring} ${cat.color.replace('text-', 'border-').replace('text-arc-secondary', 'border-white/15')}`
                  : 'border-white/8 hover:border-white/18 hover:bg-bg-surface/50'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 transition-all ${
                selected === cat.id ? `${cat.ring} ${cat.color}` : 'border-white/8 text-arc-muted bg-white/3'
              }`}>
                {cat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-serif text-lg transition-colors ${selected === cat.id ? 'text-white' : 'text-arc-secondary'}`}>{cat.label}</p>
                <p className="text-xs text-arc-muted">{cat.sub}</p>
              </div>
              {selected === cat.id && (
                <div className="w-5 h-5 rounded-full bg-gold flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-bg-primary" />
                </div>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={onNext}
          disabled={!selected}
          className="btn-gold w-full py-3.5 text-base disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={onNext}
          className="w-full py-2.5 text-sm text-arc-muted hover:text-white transition-colors mt-2"
        >
          Skip this step
        </button>
      </div>
    </div>
  );
}

// ─── Step: What Works ─────────────────────────────────────────────────────────

function StepWhatWorks() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <p className="section-eyebrow mb-2">Step 1 of 4</p>
        <h2 className="font-serif text-3xl text-white mb-2">What actually works</h2>
        <p className="text-arc-secondary text-sm">The difference between a scroll-stop and a scroll-past.</p>
      </div>

      {/* Good vs bad */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Good */}
        <div className="rounded-2xl border border-arc-success/25 overflow-hidden">
          <div
            className="relative h-48"
            style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(212,175,55,0.28) 0%, rgba(160,120,50,0.12) 45%, rgba(10,10,15,0.97) 80%)' }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-amber-200/20 border-2 border-amber-300/30 flex items-center justify-center">
                <User className="w-10 h-10 text-amber-200/70" />
              </div>
            </div>
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-arc-success/15 border border-arc-success/30 text-xs font-semibold text-arc-success">
                <Check className="w-3 h-3" /> This works
              </span>
            </div>
          </div>
          <div className="p-4 bg-bg-surface space-y-2.5">
            {[
              ['Lighting',     'Bright, soft, and even'],
              ['Framing',      'Subject centered and clear'],
              ['Clarity',      'Sharp, high resolution'],
              ['Composition',  'Clean, uncluttered background'],
            ].map(([label, desc]) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-arc-success/15 border border-arc-success/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-2.5 h-2.5 text-arc-success" />
                </div>
                <span className="text-xs font-medium text-white">{label}</span>
                <span className="text-xs text-arc-muted">— {desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bad */}
        <div className="rounded-2xl border border-arc-error/25 overflow-hidden">
          <div
            className="relative h-48"
            style={{ background: 'radial-gradient(ellipse at 25% 65%, rgba(40,50,70,0.55) 0%, rgba(10,12,20,1) 65%)' }}
          >
            <div className="absolute" style={{ top: '20%', left: '30%' }}>
              <div
                className="w-11 h-11 rounded-full bg-slate-600/30 border border-slate-500/20 flex items-center justify-center"
                style={{ filter: 'blur(1.5px)' }}
              >
                <User className="w-6 h-6 text-slate-400/30" />
              </div>
            </div>
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-arc-error/15 border border-arc-error/25 text-xs font-semibold text-arc-error">
                <X className="w-3 h-3" /> Loses sales
              </span>
            </div>
          </div>
          <div className="p-4 bg-bg-surface space-y-2.5">
            {[
              ['Dark or harsh shadows',  'Kills the mood'],
              ['Blurry or shaky',        'Looks unprofessional'],
              ['Subject cut off',        'Bad framing loses buyers'],
              ['Cluttered background',   'Distracts from the subject'],
            ].map(([label, desc]) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-arc-error/10 border border-arc-error/25 flex items-center justify-center flex-shrink-0">
                  <X className="w-2.5 h-2.5 text-arc-error" />
                </div>
                <span className="text-xs font-medium text-white">{label}</span>
                <span className="text-xs text-arc-muted">— {desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pro tip */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-gold/5 border border-gold/20">
        <Sparkles className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
        <p className="text-xs text-arc-secondary leading-relaxed">
          <strong className="text-white">Pro tip:</strong> Natural window light is your best tool. Face a window for soft, even lighting — no studio required. Shoot during the day for best results.
        </p>
      </div>
    </div>
  );
}

// ─── Step: Content Types ──────────────────────────────────────────────────────

function StepContentTypes() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <p className="section-eyebrow mb-2">Step 2 of 4</p>
        <h2 className="font-serif text-3xl text-white mb-2">What to post</h2>
        <p className="text-arc-secondary text-sm">Three content formats that consistently perform on Archangels.</p>
      </div>

      <div className="space-y-4">
        {/* Photo set */}
        <div className="card-surface rounded-2xl p-5 flex gap-5 items-start">
          <div className="w-20 h-20 rounded-xl flex-shrink-0 grid grid-cols-2 gap-0.5 overflow-hidden p-0.5">
            {['rgba(212,175,55,0.3)', 'rgba(180,100,140,0.22)', 'rgba(100,140,210,0.22)', 'rgba(212,175,55,0.18)'].map((bg, i) => (
              <div key={i} className="rounded-sm" style={{ background: bg }} />
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <p className="font-serif text-white">Photo Set</p>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gold/12 border border-gold/25 text-gold">MOST POPULAR</span>
            </div>
            <p className="text-xs text-arc-secondary leading-relaxed mb-2.5">
              4–20 curated photos. Each image builds anticipation. Lock your best shots for paying members and offer a teaser for free.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-arc-muted">
              <span className="flex items-center gap-1"><Camera className="w-3 h-3" /> 4–20 photos</span>
              <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> $5–$25 per set</span>
            </div>
          </div>
        </div>

        {/* Short clip */}
        <div className="card-surface rounded-2xl p-5 flex gap-5 items-start">
          <div
            className="w-20 h-20 rounded-xl flex-shrink-0 flex flex-col items-center justify-center gap-2 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(100,80,200,0.22) 0%, rgba(30,20,60,0.45) 100%)' }}
          >
            <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
              <Play className="w-4 h-4 text-white/70 ml-0.5" />
            </div>
            <div className="w-14 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full w-2/5 bg-gold/60 rounded-full" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <p className="font-serif text-white">Short Clip</p>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-500/10 border border-violet-500/20 text-violet-400">HIGH ENGAGEMENT</span>
            </div>
            <p className="text-xs text-arc-secondary leading-relaxed mb-2.5">
              Under 30 seconds. Works as a free teaser that auto-plays in feeds, or as premium locked content that members pay to unlock.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-arc-muted">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Under 30 seconds</span>
              <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> $5–$20</span>
            </div>
          </div>
        </div>

        {/* Teaser + locked */}
        <div className="card-surface rounded-2xl p-5 flex gap-5 items-start">
          <div className="w-20 h-20 rounded-xl flex-shrink-0 overflow-hidden flex">
            <div
              className="w-1/2 h-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.25) 0%, rgba(180,140,60,0.12) 100%)' }}
            >
              <Eye className="w-4 h-4 text-gold/60" />
            </div>
            <div className="w-1/2 h-full bg-black/60 flex items-center justify-center border-l border-white/8">
              <Lock className="w-4 h-4 text-white/35" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <p className="font-serif text-white">Teaser + Locked</p>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400">SMART STRATEGY</span>
            </div>
            <p className="text-xs text-arc-secondary leading-relaxed mb-2.5">
              Post a free preview that hooks visitors, then lock the premium version. Show enough to make them want more — not enough to satisfy.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-arc-muted">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Free teaser</span>
              <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Paid full version</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step: Pricing ────────────────────────────────────────────────────────────

function StepPricing() {
  const [selected, setSelected] = useState<string | null>(null);

  const tiers = [
    {
      id: 'quick',
      price: '$5',
      label: 'Quick Unlock',
      badge: 'Fast Sales',
      badgeCls: 'text-green-400 bg-green-400/8 border-green-400/25',
      iconCls: 'text-green-400 bg-green-400/10 border-green-400/25',
      activeBorder: 'border-green-400/35 bg-green-400/5',
      icon: <Zap className="w-5 h-5" />,
      desc: 'Lowest friction. Best for new audiences and building your first unlock count.',
      conversion: '~58% conversion',
      convCls: 'text-green-400',
    },
    {
      id: 'standard',
      price: '$12',
      label: 'Premium Post',
      badge: 'Most Popular',
      badgeCls: 'text-blue-400 bg-blue-400/8 border-blue-400/25',
      iconCls: 'text-blue-400 bg-blue-400/10 border-blue-400/25',
      activeBorder: 'border-blue-400/35 bg-blue-400/5',
      icon: <TrendingUp className="w-5 h-5" />,
      desc: 'Sweet spot for exclusive photos and clips. Strong balance of volume and revenue.',
      conversion: '~38% conversion',
      convCls: 'text-blue-400',
    },
    {
      id: 'premium',
      price: '$25',
      label: 'Limited Drop',
      badge: 'High Value',
      badgeCls: 'text-amber-400 bg-amber-400/8 border-amber-400/25',
      iconCls: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
      activeBorder: 'border-amber-400/35 bg-amber-400/5',
      icon: <Diamond className="w-5 h-5" />,
      desc: 'Use scarcity. Set a limited unlock count to drive urgency. For your best work only.',
      conversion: '~18% conversion',
      convCls: 'text-amber-400',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <p className="section-eyebrow mb-2">Step 3 of 4</p>
        <h2 className="font-serif text-3xl text-white mb-2">How to price it</h2>
        <p className="text-arc-secondary text-sm">Tap each tier to see the strategy. You can always change your price later.</p>
      </div>

      <div className="space-y-3 mb-6">
        {tiers.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id === selected ? null : t.id)}
            className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 ${
              selected === t.id ? t.activeBorder : 'border-white/10 hover:border-white/20 hover:bg-bg-hover'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${t.iconCls}`}>
                {t.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="font-serif text-white text-xl">{t.price}</span>
                  <span className="text-sm text-arc-secondary">— {t.label}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${t.badgeCls}`}>{t.badge}</span>
                </div>
                {selected === t.id && (
                  <p className="text-xs text-arc-muted leading-relaxed mt-1">{t.desc}</p>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <p className={`text-xs font-mono font-semibold ${t.convCls}`}>{t.conversion}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-gold/5 border border-gold/20">
        <Sparkles className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
        <p className="text-xs text-arc-secondary leading-relaxed">
          <strong className="text-white">Recommendation:</strong> Start with a $5 post to build social proof and your first unlocks. Once you have 10+ unlocks, raise prices on future drops.
        </p>
      </div>
    </div>
  );
}

// ─── Step: Walkthrough ────────────────────────────────────────────────────────

function StepWalkthrough() {
  const [active, setActive] = useState(0);

  const walkthroughSteps = [
    {
      icon: <Upload className="w-6 h-6" />,
      label: 'Upload your content',
      desc: 'Choose your best photo or video. Use our in-app editor to enhance brightness, add filters, trim your clip, and capture a thumbnail.',
      color: 'text-gold',
      ring: 'bg-gold/10 border-gold/30',
    },
    {
      icon: <Eye className="w-6 h-6" />,
      label: 'Set a preview',
      desc: 'Upload a teaser image that visitors see before unlocking. Make it compelling — show just enough to create desire without giving it away.',
      color: 'text-blue-400',
      ring: 'bg-blue-400/10 border-blue-400/30',
    },
    {
      icon: <DollarSign className="w-6 h-6" />,
      label: 'Set your price',
      desc: 'Start at $5–$12 for your first post. Optionally add a limited unlock count or subscriber discount to drive conversions.',
      color: 'text-green-400',
      ring: 'bg-green-400/10 border-green-400/30',
    },
    {
      icon: <Check className="w-6 h-6" />,
      label: 'Submit for review',
      desc: 'Content is reviewed by our team within 24 hours. Once approved, it goes live and is instantly purchasable by members.',
      color: 'text-violet-400',
      ring: 'bg-violet-400/10 border-violet-400/30',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <p className="section-eyebrow mb-2">Step 4 of 4</p>
        <h2 className="font-serif text-3xl text-white mb-2">Your first post</h2>
        <p className="text-arc-secondary text-sm">Four steps, under 3 minutes. Tap each to expand.</p>
      </div>

      {/* Steps list */}
      <div className="relative">
        {/* vertical connector */}
        <div className="absolute left-[22px] top-10 bottom-10 w-px bg-white/8" style={{ zIndex: 0 }} />

        <div className="space-y-2 relative" style={{ zIndex: 1 }}>
          {walkthroughSteps.map((ws, i) => {
            const done = i < active;
            const isActive = i === active;
            return (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`w-full text-left flex gap-4 p-4 rounded-2xl border transition-all duration-200 ${
                  isActive ? 'border-white/20 bg-bg-surface' : 'border-transparent hover:border-white/8 hover:bg-bg-surface/40'
                }`}
              >
                {/* Number / icon circle */}
                <div className={`w-11 h-11 rounded-full border flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                  done
                    ? 'bg-arc-success/10 border-arc-success/30'
                    : isActive
                    ? `${ws.ring} ${ws.color}`
                    : 'bg-white/4 border-white/10 text-arc-muted'
                }`}>
                  {done ? <Check className="w-5 h-5 text-arc-success" /> : ws.icon}
                </div>

                <div className="flex-1 min-w-0 py-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isActive ? 'text-white' : done ? 'text-arc-secondary' : 'text-arc-muted'}`}>
                      {ws.label}
                    </span>
                    {done && <span className="text-[10px] font-bold text-arc-success tracking-wide">DONE</span>}
                  </div>
                  {isActive && (
                    <p className="text-xs text-arc-muted leading-relaxed mt-1.5">{ws.desc}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mini progress nav */}
      {active < walkthroughSteps.length - 1 && (
        <button
          onClick={() => setActive((a) => Math.min(a + 1, walkthroughSteps.length - 1))}
          className="w-full mt-5 py-2.5 rounded-xl border border-white/10 text-sm text-arc-secondary hover:text-white hover:border-white/20 transition-all"
        >
          Next step →
        </button>
      )}
    </div>
  );
}

// ─── Step: First Action ───────────────────────────────────────────────────────

function StepFirstAction({ onNavigate }: { onNavigate: (to: string) => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <p className="section-eyebrow mb-2">First Move</p>
          <h2 className="font-serif text-3xl text-white mb-2">Pick one. Do it now.</h2>
          <p className="text-arc-secondary text-sm">Momentum matters more than perfection.</p>
        </div>

        <div className="space-y-3 mb-5">
          <button
            onClick={() => onNavigate('/upload')}
            className="w-full text-left p-5 rounded-2xl border border-gold/30 bg-gold/5 hover:bg-gold/9 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/25 flex items-center justify-center flex-shrink-0">
                <Image className="w-6 h-6 text-gold" />
              </div>
              <div className="flex-1">
                <p className="font-serif text-white mb-1 text-lg">Create my first locked post</p>
                <p className="text-xs text-arc-muted leading-relaxed">Upload a photo or video, set a price, and submit for review. Your first earnings start here.</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gold/50 group-hover:text-gold transition-colors flex-shrink-0 mt-1" />
            </div>
          </button>

          <button
            onClick={() => onNavigate('/messages')}
            className="w-full text-left p-5 rounded-2xl border border-white/10 hover:border-white/20 hover:bg-bg-hover transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-arc-secondary group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="font-serif text-white mb-1 text-lg">Send my first custom offer</p>
                <p className="text-xs text-arc-muted leading-relaxed">Reach out to a fan with a custom piece at your price. No upload required — start earning today.</p>
              </div>
              <ChevronRight className="w-5 h-5 text-arc-muted/50 group-hover:text-white transition-colors flex-shrink-0 mt-1" />
            </div>
          </button>
        </div>

        <button
          onClick={() => onNavigate('/creator')}
          className="w-full py-2.5 text-sm text-arc-muted hover:text-white transition-colors text-center"
        >
          I'll explore on my own
        </button>
      </div>
    </div>
  );
}

// ─── Step: Complete ───────────────────────────────────────────────────────────

function StepComplete({ onNavigate }: { onNavigate: (to: string) => void }) {
  const actions = [
    {
      icon: <Camera className="w-5 h-5" />,
      label: 'Create a photo set',
      sub: 'Your fastest path to first earnings',
      to: '/upload',
    },
    {
      icon: <Video className="w-5 h-5" />,
      label: 'Create a teaser clip',
      sub: 'High engagement, drives unlocks',
      to: '/upload',
    },
    {
      icon: <Package className="w-5 h-5" />,
      label: 'Create a bundle',
      sub: 'Group content for higher perceived value',
      to: '/creator',
    },
    {
      icon: <Diamond className="w-5 h-5" />,
      label: 'Create a limited drop',
      sub: 'Scarcity creates urgency — sells fast',
      to: '/upload',
    },
  ];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.11) 0%, transparent 60%)' }}
    >
      <div className="max-w-md w-full text-center mb-10">
        <div className="w-20 h-20 rounded-full bg-arc-success/10 border border-arc-success/30 flex items-center justify-center mx-auto mb-7">
          <Check className="w-9 h-9 text-arc-success" />
        </div>
        <p className="section-eyebrow mb-3">Training Complete</p>
        <h1 className="font-serif text-4xl text-white mb-4 leading-tight">
          You're live.<br />Now let's earn.
        </h1>
        <p className="text-arc-secondary text-sm leading-relaxed max-w-xs mx-auto">
          You know what to post, how to price it, and how to publish. Your starter pack is ready — pick one and go.
        </p>
      </div>

      <div className="max-w-md w-full mb-8">
        <p className="text-[10px] font-bold tracking-widest uppercase text-arc-muted mb-3">Starter Pack</p>
        <div className="space-y-2">
          {actions.map(({ icon, label, sub, to }) => (
            <button
              key={label}
              onClick={() => onNavigate(to)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/8 hover:border-gold/30 hover:bg-gold/5 transition-all group text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-arc-muted group-hover:text-gold group-hover:border-gold/20 group-hover:bg-gold/10 transition-all">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-xs text-arc-muted">{sub}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-arc-muted/40 group-hover:text-gold transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onNavigate('/creator')}
        className="btn-gold px-8 py-3"
      >
        <Crown className="w-4 h-4" />
        Go to Creator Studio
      </button>
    </div>
  );
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

const STEPS = [
  'welcome',
  'content-category',
  'what-works',
  'content-types',
  'pricing',
  'walkthrough',
  'first-action',
  'complete',
] as const;
type StepId = typeof STEPS[number];

const LEARNING_STEPS: StepId[] = ['what-works', 'content-types', 'pricing', 'walkthrough'];

export default function CreatorOnboarding() {
  const [stepIndex, setStepIndex] = useState(0);
  const navigate = useNavigate();

  const current = STEPS[stepIndex];
  const hasNav = (LEARNING_STEPS as string[]).includes(current);
  const dotIndex = LEARNING_STEPS.indexOf(current as typeof LEARNING_STEPS[number]);

  function next() {
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
    else navigate('/creator');
  }

  function back() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: '#09090B' }}>
      {/* Gold progress bar — learning steps only */}
      {hasNav && (
        <div className="flex-shrink-0 h-0.5 bg-white/5">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${((dotIndex + 1) / LEARNING_STEPS.length) * 100}%`,
              background: '#D4AF37',
            }}
          />
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        {current === 'welcome'           && <StepWelcome onNext={next} onSkip={() => navigate('/creator')} />}
        {current === 'content-category'  && <StepContentCategory onNext={next} />}
        {current === 'what-works'        && <StepWhatWorks />}
        {current === 'content-types'     && <StepContentTypes />}
        {current === 'pricing'       && <StepPricing />}
        {current === 'walkthrough'   && <StepWalkthrough />}
        {current === 'first-action'  && <StepFirstAction onNavigate={navigate} />}
        {current === 'complete'      && <StepComplete onNavigate={navigate} />}
      </div>

      {/* Bottom nav — learning steps only */}
      {hasNav && (
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-t border-white/8" style={{ background: '#0F0F13' }}>
          <button
            onClick={back}
            className="flex items-center gap-1.5 text-sm text-arc-muted hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {/* Dot indicators */}
          <div className="flex items-center gap-1.5">
            {LEARNING_STEPS.map((s, i) => (
              <div
                key={s}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === dotIndex ? '16px' : '6px',
                  height: '6px',
                  background: i === dotIndex ? '#D4AF37' : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>

          <button
            onClick={next}
            className="flex items-center gap-1.5 text-sm font-medium text-white hover:text-gold transition-colors"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
