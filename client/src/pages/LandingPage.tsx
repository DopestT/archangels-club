import React, { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, ChevronRight, Shield, Crown, Star, ArrowRight, Check, Users, Image, TrendingUp, Zap, MessageCircle, Gift } from 'lucide-react';
import { sampleCreators, sampleContent } from '../data/seed';
import Avatar from '../components/ui/Avatar';
import { VerifiedBadge } from '../components/ui/Badge';
import Logo from '../components/brand/Logo';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

interface PlatformStats { creator_count: number; member_count: number; content_count: number }
interface LiveCreator { id: string; display_name: string; username: string; avatar_url: string; subscription_price: number; is_verified_creator: boolean; tags: string[] }

export default function LandingPage() {
  useEffect(() => { document.title = 'Archangels Club — Private Creator Access'; }, []);

  const { isAuthenticated } = useAuth();
  const [videoKey, setVideoKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [liveCreators, setLiveCreators] = useState<LiveCreator[]>([]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    function onEnd() { setVideoKey(k => k + 1); }
    function onError() { setVideoKey(k => k + 1); }
    vid.addEventListener('ended', onEnd);
    vid.addEventListener('error', onError);
    return () => { vid.removeEventListener('ended', onEnd); vid.removeEventListener('error', onError); };
  }, [videoKey]);

  useEffect(() => {
    fetch('/api/creators/stats').then(r => r.json()).then(setStats).catch(() => {});
    fetch('/api/creators?sort=popular').then(r => r.json()).then((d: LiveCreator[]) => {
      if (Array.isArray(d) && d.length > 0) setLiveCreators(d.slice(0, 6));
    }).catch(() => {});
  }, []);

  const displayCreators = liveCreators.length > 0 ? liveCreators : sampleCreators;
  const displayContent = sampleContent;

  const creatorCount = stats?.creator_count ?? null;
  const memberCount = stats?.member_count ?? null;

  return (
    <div className="bg-bg-primary">

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-start justify-center overflow-hidden bg-black">
        <video
          key={videoKey}
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          autoPlay muted playsInline
        >
          <source src="/archangelshero.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/35 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50 pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-16 pb-24">
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

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            {isAuthenticated ? (
              <>
                <Link to="/explore" className="btn-gold px-8 py-4 text-base gap-3">
                  Explore Creators <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/dashboard" className="btn-outline px-8 py-4 text-base">My Dashboard</Link>
              </>
            ) : (
              <>
                <Link to="/signup" className="btn-gold px-8 py-4 text-base gap-3">
                  Request Access <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/explore" className="btn-outline px-8 py-4 text-base">Explore Preview</Link>
              </>
            )}
          </div>

          {/* Live platform stats */}
          {(creatorCount !== null || memberCount !== null) && (
            <div className="flex items-center justify-center gap-8 mb-10">
              {creatorCount !== null && creatorCount > 0 && (
                <div className="text-center">
                  <div className="font-serif text-2xl text-gold">{creatorCount.toLocaleString()}+</div>
                  <div className="text-xs text-arc-muted mt-0.5">Verified Creators</div>
                </div>
              )}
              {memberCount !== null && memberCount > 0 && (
                <div className="w-px h-8 bg-gold-border/40" />
              )}
              {memberCount !== null && memberCount > 0 && (
                <div className="text-center">
                  <div className="font-serif text-2xl text-gold">{memberCount.toLocaleString()}+</div>
                  <div className="text-xs text-arc-muted mt-0.5">Active Members</div>
                </div>
              )}
            </div>
          )}

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
            <h2 className="font-serif text-3xl text-white mt-3 mb-4">A Glimpse Behind the Door</h2>
            <p className="text-arc-secondary max-w-xl mx-auto">Members see everything. You see enough to know you want in.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
            {displayContent.slice(0, 8).map((content, i) => (
              <div
                key={content.id}
                className="relative rounded-xl overflow-hidden bg-bg-hover"
                style={{ aspectRatio: i % 3 === 0 ? '3/4' : '1/1' }}
              >
                {content.preview_url && (
                  <img src={content.preview_url} alt="" className="w-full h-full object-cover locked-blur" />
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
              Unlock Full Access <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── MEMBERSHIP BENEFITS ─── */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="section-eyebrow">Member Benefits</span>
            <h2 className="font-serif text-3xl text-white mt-3">Everything Membership Unlocks</h2>
            <p className="text-arc-secondary mt-3 max-w-xl mx-auto">
              One membership opens every door. Subscribe to creators individually or unlock content à la carte.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: <Lock className="w-5 h-5" />, title: 'Exclusive Content', body: 'Access locked drops, private photo sets, and video content not available anywhere else.' },
              { icon: <MessageCircle className="w-5 h-5" />, title: 'Direct Messaging', body: 'Message creators directly. No bots, no middlemen — real conversations.' },
              { icon: <Gift className="w-5 h-5" />, title: 'Custom Requests', body: 'Commission personalized content from your favorite creators at your price.' },
              { icon: <Zap className="w-5 h-5" />, title: 'Early Access Drops', body: 'Members get first access to limited releases before they sell out.' },
              { icon: <Star className="w-5 h-5" />, title: 'Verified Creators Only', body: 'Every creator is ID-verified and approved. No fake accounts, no catfishing.' },
              { icon: <Shield className="w-5 h-5" />, title: 'Full Privacy', body: 'Your identity is protected. Discreet billing, encrypted data, zero exposure.' },
            ].map(({ icon, title, body }) => (
              <div key={title} className="card-surface p-6">
                <div className="w-10 h-10 rounded-xl bg-gold-muted border border-gold-border flex items-center justify-center text-gold mb-4">
                  {icon}
                </div>
                <h3 className="font-serif text-white text-lg mb-2">{title}</h3>
                <p className="text-sm text-arc-secondary leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-24 bg-bg-surface border-y border-gold-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="section-eyebrow">The Process</span>
            <h2 className="font-serif text-3xl text-white mt-3">How It Works</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: <Shield className="w-6 h-6" />, title: 'Request Access', body: 'Apply for membership. We review every application. Not everyone gets in — that\'s the point.' },
              { step: '02', icon: <Crown className="w-6 h-6" />, title: 'Choose a Creator', body: 'Browse verified creators. Subscribe to unlock their full catalog, or unlock individual drops.' },
              { step: '03', icon: <Lock className="w-6 h-6" />, title: 'Unlock Private Content', body: 'Access locked content, send custom requests, tip creators, and message directly.' },
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
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <span className="section-eyebrow">Private Creators</span>
              <h2 className="font-serif text-3xl text-white mt-3">Featured Profiles</h2>
            </div>
            <Link to="/explore" className="btn-outline px-5 py-2.5 text-sm hidden sm:flex">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {displayCreators.map((creator) => (
              <Link key={creator.id} to={`/creator/${creator.username}`} className="group text-center">
                <div className="relative mx-auto mb-3 w-16 h-16">
                  <Avatar src={creator.avatar_url} name={creator.display_name} size="lg" ring />
                  {creator.is_verified_creator && (
                    <VerifiedBadge className="absolute -bottom-0.5 -right-0.5" />
                  )}
                </div>
                <p className="text-sm font-serif text-white group-hover:text-gold transition-colors mb-1 truncate">
                  {creator.display_name}
                </p>
                <p className="text-xs text-arc-muted">{formatCurrency(creator.subscription_price)}/mo</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SUBSCRIPTION TIERS ─── */}
      <section className="py-24 bg-bg-surface border-y border-gold-border/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="section-eyebrow">Access Tiers</span>
            <h2 className="font-serif text-3xl text-white mt-3">Choose How You Access</h2>
            <p className="text-arc-secondary mt-3">No platform subscription fee. Pay only for the creators you want.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Preview',
                price: 'Free',
                sub: 'No card required',
                highlight: false,
                features: ['Browse creator profiles', 'See blurred content previews', 'View creator pricing', 'Apply for membership'],
              },
              {
                name: 'Member',
                price: 'Free to join',
                sub: 'Approved applications only',
                highlight: true,
                features: ['Full profile access', 'Unlock à la carte content', 'Direct creator messaging', 'Custom request submissions', 'Early drop notifications'],
              },
              {
                name: 'Subscriber',
                price: 'Per creator',
                sub: 'Starting from $9.99/mo',
                highlight: false,
                features: ['Full catalog access', 'Subscriber-only content', 'Priority messaging', 'Discounted unlocks', 'Exclusive subscriber drops'],
              },
            ].map(({ name, price, sub, highlight, features }) => (
              <div
                key={name}
                className={`rounded-2xl p-7 border flex flex-col ${highlight ? 'bg-gold-muted border-gold/50 relative' : 'card-surface'}`}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gold text-black text-xs font-bold px-3 py-1 rounded-full tracking-wider uppercase">Most Popular</span>
                  </div>
                )}
                <div className="mb-6">
                  <p className="text-arc-muted text-sm font-sans mb-1">{name}</p>
                  <p className="font-serif text-2xl text-white">{price}</p>
                  <p className="text-xs text-arc-muted mt-1">{sub}</p>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-arc-secondary">
                      <Check className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className={highlight ? 'btn-gold w-full justify-center' : 'btn-outline w-full justify-center'}
                >
                  {name === 'Preview' ? 'Explore Free' : 'Get Started'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BECOME A CREATOR ─── */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gold/3 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="section-eyebrow">For Creators</span>
              <h2 className="font-serif text-4xl text-white mt-4 mb-5 leading-tight">
                Earn More.<br />
                <em className="text-gradient-gold not-italic">Own Your Audience.</em>
              </h2>
              <p className="text-arc-secondary text-lg leading-relaxed mb-8">
                Archangels Club gives verified creators a private, premium platform to monetize
                their content at rates they control — with no algorithm, no shadow-banning, and no race to the bottom.
              </p>
              <ul className="space-y-4 mb-10">
                {[
                  { icon: <TrendingUp className="w-4 h-4" />, text: 'Keep up to 80% of every transaction' },
                  { icon: <Users className="w-4 h-4" />, text: 'Set your own subscription and content prices' },
                  { icon: <Image className="w-4 h-4" />, text: 'Publish photos, videos, audio, and written content' },
                  { icon: <Zap className="w-4 h-4" />, text: 'Instant payouts via Stripe — no waiting 30 days' },
                ].map(({ icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-sm text-arc-secondary">
                    <span className="text-gold">{icon}</span>
                    {text}
                  </li>
                ))}
              </ul>
              <Link to="/apply-creator" className="btn-gold px-8 py-4 text-base">
                Apply as a Creator <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Creator Payout', value: 'Up to 80%' },
                { label: 'Payout Speed', value: 'Instant' },
                { label: 'Min. Subscription', value: '$9.99/mo' },
                { label: 'Content Types', value: '4 formats' },
              ].map(({ label, value }) => (
                <div key={label} className="card-surface p-6 text-center">
                  <div className="font-serif text-2xl text-gold mb-1">{value}</div>
                  <div className="text-xs text-arc-muted">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── SCARCITY / NOT PUBLIC ─── */}
      <section className="py-24 bg-bg-surface border-y border-gold-border/30">
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
            Apply for Access <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-32 relative overflow-hidden border-t border-gold-border/30">
        <div className="absolute inset-0 bg-gradient-to-b from-bg-primary via-bg-surface to-bg-primary pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Crown className="w-10 h-10 text-gold mx-auto mb-6 opacity-80" />
          <h2 className="font-serif text-4xl sm:text-5xl text-white mb-5">Entry Is Earned.</h2>
          <p className="text-arc-secondary text-lg mb-10">
            Your access to the private world of Archangels begins with a single request.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup" className="btn-gold px-10 py-4 text-base">
              Request Access Now <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/explore" className="btn-outline px-8 py-4 text-base">Explore First</Link>
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
