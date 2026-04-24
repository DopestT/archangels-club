import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, ChevronRight, Shield, Crown, Star, ArrowRight, Check } from 'lucide-react';
import { sampleCreators, sampleContent } from '../data/seed';
import Avatar from '../components/ui/Avatar';
import { VerifiedBadge } from '../components/ui/Badge';
import Logo from '../components/brand/Logo';
import { formatCurrency } from '../lib/utils';

export default function LandingPage() {
  return (
    <div className="bg-bg-primary">

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gold/4 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gold/3 rounded-full blur-3xl" />
          <div className="absolute top-0 right-0 w-72 h-72 bg-gold/3 rounded-full blur-3xl" />
        </div>

        {/* Subtle grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(212,175,55,1) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-24 pb-32">
          {/* Primary logo — hero */}
          <div className="flex justify-center mb-10">
            <Logo variant="primary" size="lg" />
          </div>

          <div className="inline-flex items-center gap-2 members-pill mb-8">
            <Lock className="w-3 h-3" />
            Private Access Only
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-white mb-6 leading-tight">
            Where Access<br />
            <em className="text-gradient-gold not-italic">Is Granted.</em>
          </h1>

          <p className="text-lg text-arc-secondary max-w-2xl mx-auto leading-relaxed mb-10">
            A members-only platform for exclusive creator content, private drops, and custom requests.
            Not public. Not open to everyone. Access is earned.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/signup" className="btn-gold px-8 py-4 text-base gap-3">
              Request Access
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/explore" className="btn-outline px-8 py-4 text-base">
              Explore Preview
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center flex-wrap gap-6 text-xs text-arc-muted">
            {['Age Verified Creators', 'Content Moderated', 'Secure Payments', '18+ Platform'].map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-gold/60" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BLURRED PREVIEW GRID ─── */}
      <section className="py-24 bg-bg-surface border-y border-gold-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="section-eyebrow">Locked Preview</span>
            <h2 className="font-serif text-3xl text-white mt-3 mb-4">
              A Glimpse Behind the Door
            </h2>
            <p className="text-arc-secondary max-w-xl mx-auto">
              Members see everything. You see enough to know you want in.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
            {sampleContent.slice(0, 8).map((content, i) => (
              <div
                key={content.id}
                className="relative rounded-xl overflow-hidden bg-bg-hover"
                style={{ aspectRatio: i % 3 === 0 ? '3/4' : '1/1' }}
              >
                {content.preview_url && (
                  <img
                    src={content.preview_url}
                    alt=""
                    className="w-full h-full object-cover locked-blur"
                  />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-primary/40">
                  <div className="w-10 h-10 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center mb-2">
                    <Lock className="w-4 h-4 text-gold" />
                  </div>
                  <span className="text-xs text-gold font-sans">Members Only</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link to="/signup" className="btn-gold">
              Unlock Full Access
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="section-eyebrow">The Process</span>
            <h2 className="font-serif text-3xl text-white mt-3">How It Works</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: <Shield className="w-6 h-6" />,
                title: 'Request Access',
                body: 'Apply for membership. We review every application. Not everyone gets in — that\'s the point.',
              },
              {
                step: '02',
                icon: <Crown className="w-6 h-6" />,
                title: 'Choose a Creator',
                body: 'Browse verified creators. Subscribe to unlock their full catalog, or unlock individual drops.',
              },
              {
                step: '03',
                icon: <Lock className="w-6 h-6" />,
                title: 'Unlock Private Content',
                body: 'Access locked content, send custom requests, tip creators, and message directly.',
              },
            ].map(({ step, icon, title, body }) => (
              <div key={step} className="relative">
                <div className="card-surface p-8 h-full">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gold-muted border border-gold-border flex items-center justify-center text-gold">
                      {icon}
                    </div>
                    <span className="font-serif text-2xl text-gold/30">{step}</span>
                  </div>
                  <h3 className="font-serif text-xl text-white mb-3">{title}</h3>
                  <p className="text-sm text-arc-secondary leading-relaxed">{body}</p>
                </div>
                {step !== '03' && (
                  <div className="hidden md:flex absolute top-1/2 -right-4 -translate-y-1/2 z-10">
                    <ChevronRight className="w-6 h-6 text-gold/30" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURED CREATORS ─── */}
      <section className="py-24 bg-bg-surface border-y border-gold-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <span className="section-eyebrow">Private Creators</span>
              <h2 className="font-serif text-3xl text-white mt-3">Featured Profiles</h2>
            </div>
            <Link to="/explore" className="btn-outline px-5 py-2.5 text-sm hidden sm:flex">
              View All
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {sampleCreators.map((creator) => (
              <Link
                key={creator.id}
                to={`/creator/${creator.username}`}
                className="group text-center"
              >
                <div className="relative mx-auto mb-3 w-16 h-16">
                  <Avatar src={creator.avatar_url} name={creator.display_name} size="lg" ring />
                  {creator.is_verified_creator && (
                    <VerifiedBadge className="absolute -bottom-0.5 -right-0.5" />
                  )}
                </div>
                <p className="text-sm font-serif text-white group-hover:text-gold transition-colors mb-1 truncate">
                  {creator.display_name}
                </p>
                <p className="text-xs text-arc-muted">
                  {formatCurrency(creator.subscription_price)}/mo
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SCARCITY / NOT PUBLIC ─── */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gold/3 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="section-eyebrow">Selective by Design</span>
          <h2 className="font-serif text-4xl sm:text-5xl text-white mt-4 mb-6 leading-tight">
            Not Public.<br />
            <em className="text-gradient-gold not-italic">Not For Everyone.</em>
          </h2>
          <p className="text-arc-secondary text-lg leading-relaxed mb-10 max-w-xl mx-auto">
            Archangels Club maintains a curated membership. Every application is reviewed.
            Every creator is verified. This isn't open access — it's earned access.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
            {[
              { icon: <Shield className="w-5 h-5" />, label: 'Verified Creators Only' },
              { icon: <Lock className="w-5 h-5" />, label: 'All Content Gated' },
              { icon: <Star className="w-5 h-5" />, label: 'Curated Membership' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center justify-center gap-2.5 p-4 rounded-xl border border-gold-border/50 bg-gold-muted">
                <span className="text-gold">{icon}</span>
                <span className="text-sm text-white font-sans">{label}</span>
              </div>
            ))}
          </div>

          <Link to="/signup" className="btn-gold px-10 py-4 text-base">
            Apply for Access
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ─── PRICING PREVIEW ─── */}
      <section className="py-24 bg-bg-surface border-t border-gold-border/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="section-eyebrow">Membership</span>
            <h2 className="font-serif text-3xl text-white mt-3">Creator Pricing</h2>
            <p className="text-arc-secondary mt-3">Each creator sets their own rates. Starting prices shown.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sampleCreators.slice(0, 4).map((creator) => (
              <div key={creator.id} className="card-surface p-5 flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <Avatar src={creator.avatar_url} name={creator.display_name} size="md" ring />
                  {creator.is_verified_creator && (
                    <VerifiedBadge className="absolute -bottom-0.5 -right-0.5 w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-sm text-white">{creator.display_name}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {creator.tags.slice(0, 2).map((t) => (
                      <span key={t} className="tag-pill text-xs">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-serif text-lg text-gold">{formatCurrency(creator.subscription_price)}</div>
                  <div className="text-xs text-arc-muted">/month</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-32 relative overflow-hidden border-t border-gold-border/30">
        <div className="absolute inset-0 bg-gradient-to-b from-bg-primary via-bg-surface to-bg-primary pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Crown className="w-10 h-10 text-gold mx-auto mb-6 opacity-80" />
          <h2 className="font-serif text-4xl sm:text-5xl text-white mb-5">
            Entry Is Earned.
          </h2>
          <p className="text-arc-secondary text-lg mb-10">
            Your access to the private world of Archangels begins with a single request.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup" className="btn-gold px-10 py-4 text-base">
              Request Access Now
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/explore" className="btn-outline px-8 py-4 text-base">
              Explore First
            </Link>
          </div>

          <div className="mt-12 divider-gold" />
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-arc-muted">
            {['18+ Only', 'Age Verification Required', 'Secure · Private · Encrypted'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-gold/60" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
