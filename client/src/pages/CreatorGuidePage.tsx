import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Crown, TrendingUp, Users, Image, Zap, Lock, MessageCircle, Check, ArrowRight, Camera, Video, Music, FileText } from 'lucide-react';

export default function CreatorGuidePage() {
  useEffect(() => { document.title = 'Creator Guide — Archangels Club'; }, []);

  return (
    <div className="bg-bg-primary">

      {/* ─── HERO ─── */}
      <section className="py-24 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gold/5 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="section-eyebrow">For Creators</span>
          <h1 className="font-serif text-5xl sm:text-6xl text-white mt-4 mb-6 leading-tight">
            Earn More.<br />
            <em className="text-gradient-gold not-italic">Own Your Audience.</em>
          </h1>
          <p className="text-lg text-arc-secondary max-w-2xl mx-auto leading-relaxed">
            Archangels Club is a private, members-only platform built for verified creators
            who want to monetize their content on their own terms — no algorithm, no shadow-banning,
            no race to the bottom.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
            {['Age Verified Creators', '18+ Platform', 'Stripe Payouts', 'Curated Membership'].map((label) => (
              <span key={label} className="members-pill">{label}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHAT IS IT ─── */}
      <section className="py-20 border-t border-gold-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <span className="section-eyebrow">The Platform</span>
            <h2 className="font-serif text-3xl text-white mt-3 mb-4">What Is Archangels Club?</h2>
            <p className="text-arc-secondary max-w-2xl leading-relaxed">
              Archangels Club is a <span className="text-white font-medium">private, invitation-only creator platform</span> where
              fans pay for access they can't get anywhere else. Members must apply and be approved before they
              can spend money — which means your audience is real, committed, and willing to pay.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { icon: <Lock className="w-5 h-5" />, title: 'Gated by Design', body: 'All content is locked behind membership. Fans can browse blurred previews but pay to see everything.' },
              { icon: <Shield className="w-5 h-5" />, title: 'Verified Creators Only', body: 'Every creator is ID-verified and admin-approved. Your credibility is protected by the platform.' },
              { icon: <Users className="w-5 h-5" />, title: 'Curated Audience', body: 'Members are reviewed before they can access the platform. No bots, no fake accounts.' },
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

      {/* ─── HOW YOU GET PAID ─── */}
      <section className="py-20 border-t border-gold-border/30 bg-bg-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <span className="section-eyebrow">Revenue Streams</span>
            <h2 className="font-serif text-3xl text-white mt-3 mb-4">Three Ways to Get Paid</h2>
            <p className="text-arc-secondary max-w-2xl leading-relaxed">
              You earn <span className="text-gold font-semibold">70% of every transaction</span>. The platform takes 30%.
              Payments go directly to your Stripe account — no 30-day wait.
            </p>
          </div>

          <div className="rounded-xl border border-gold-border overflow-hidden mb-10">
            {[
              { type: 'Monthly Subscription', how: 'Fans pay a recurring monthly fee to unlock your full catalog', youSet: 'Your own price (min $9.99/mo)', cut: '70%' },
              { type: 'Locked Content (à la carte)', how: 'Individual pieces fans pay to unlock one at a time', youSet: 'Price per drop', cut: '70%' },
              { type: 'Tips', how: 'Fans send direct tips any time — no content required', youSet: "Fan's choice (min $1)", cut: '70%' },
            ].map(({ type, how, youSet, cut }, i) => (
              <div key={type} className={`grid grid-cols-1 sm:grid-cols-[2fr_2fr_1.5fr_0.8fr] gap-4 p-5 ${i > 0 ? 'border-t border-gold-border/40' : ''} ${i === 0 ? 'bg-gold-muted' : ''}`}>
                <div className="text-sm font-medium text-white">{type}</div>
                <div className="text-sm text-arc-secondary">{how}</div>
                <div className="text-sm text-arc-secondary">{youSet}</div>
                <div className="text-sm font-semibold text-gold">{cut}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { value: '70%', label: 'Creator Payout Rate' },
              { value: 'Instant', label: 'Payout Speed via Stripe' },
              { value: '$9.99/mo', label: 'Min. Subscription Price' },
              { value: '4 formats', label: 'Content Types Supported' },
            ].map(({ value, label }) => (
              <div key={label} className="card-surface p-5 text-center">
                <div className="font-serif text-2xl text-gold mb-1">{value}</div>
                <div className="text-xs text-arc-muted">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CONTENT TYPES ─── */}
      <section className="py-20 border-t border-gold-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <span className="section-eyebrow">Content</span>
            <h2 className="font-serif text-3xl text-white mt-3 mb-4">What You Can Publish</h2>
            <p className="text-arc-secondary max-w-2xl leading-relaxed">
              Publish in four formats. Set each piece as free (all members) or locked (pay to unlock).
              Subscribers get a discount you control.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              { icon: <Camera className="w-5 h-5" />, title: 'Photos', body: 'Photo sets and individual images — blurred in preview, full quality on unlock.' },
              { icon: <Video className="w-5 h-5" />, title: 'Video', body: 'Upload video content directly. Stored securely via Cloudinary.' },
              { icon: <Music className="w-5 h-5" />, title: 'Audio', body: 'Voice notes, music, podcasts — locked behind your price.' },
              { icon: <FileText className="w-5 h-5" />, title: 'Written Content', body: 'Stories, journals, essays — gated and purchasable.' },
            ].map(({ icon, title, body }) => (
              <div key={title} className="card-surface p-6 flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-gold-muted border border-gold-border flex items-center justify-center text-gold flex-shrink-0">
                  {icon}
                </div>
                <div>
                  <h3 className="font-serif text-white text-lg mb-1">{title}</h3>
                  <p className="text-sm text-arc-secondary leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW TO GET STARTED ─── */}
      <section className="py-20 border-t border-gold-border/30 bg-bg-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <span className="section-eyebrow">Getting Started</span>
            <h2 className="font-serif text-3xl text-white mt-3">How to Start Earning</h2>
          </div>

          <div className="divide-y divide-gold-border/30">
            {[
              { step: '01', title: 'Apply as a Creator', body: 'Submit your creator application. The admin team reviews every application — not everyone gets approved, which keeps the platform premium and your audience valuable.' },
              { step: '02', title: 'Get Verified & Approved', body: 'Complete age and identity verification. Once approved, your profile goes live and appears to members on the Explore page.' },
              { step: '03', title: 'Connect Your Stripe Account', body: 'Link your Stripe payout account in Creator Settings. This is how you receive money — directly to your bank, instantly after each transaction clears.' },
              { step: '04', title: 'Set Your Prices', body: 'Choose your monthly subscription price. Set a per-piece price on any content you want to sell à la carte. You control every number.' },
              { step: '05', title: 'Upload & Publish', body: 'Use the Creator Studio to upload photos, video, audio, or written content. Mark content as free or locked. Publish whenever you\'re ready.' },
              { step: '06', title: 'Engage Your Audience', body: 'Message members directly. Accept custom content requests. Build a relationship with fans who are paying specifically for you — not an algorithm\'s recommendation.' },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-6 py-7">
                <div className="font-serif text-2xl text-gold/30 flex-shrink-0 w-10 leading-tight pt-0.5">{step}</div>
                <div>
                  <h3 className="font-serif text-white text-xl mb-2">{title}</h3>
                  <p className="text-sm text-arc-secondary leading-relaxed max-w-2xl">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHY IT'S DIFFERENT ─── */}
      <section className="py-20 border-t border-gold-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <span className="section-eyebrow">Why It's Different</span>
            <h2 className="font-serif text-3xl text-white mt-3 mb-4">What You Won't Find Here</h2>
            <p className="text-arc-secondary max-w-2xl leading-relaxed">
              Archangels Club is built differently from public creator platforms by design.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
            {[
              'No algorithm burying your posts',
              'No shadow-banning or reach suppression',
              'No waiting 30 days for payouts',
              'No fake followers or bot engagement',
              'No platform price-setting — you control your rates',
              'No competing with free content on the same feed',
              'No race to post constantly to stay visible',
              'No public exposure — discreet billing for fans',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-arc-secondary">
                <Check className="w-4 h-4 text-gold flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── YOUR AUDIENCE ─── */}
      <section className="py-20 border-t border-gold-border/30 bg-bg-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <span className="section-eyebrow">Your Audience</span>
            <h2 className="font-serif text-3xl text-white mt-3 mb-4">Who Your Members Are</h2>
            <p className="text-arc-secondary max-w-2xl leading-relaxed">
              Members aren't casual scrollers — they applied to be here. Every person in your audience
              has been reviewed and approved, which means they are genuinely interested in paying creators like you.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { icon: <Shield className="w-5 h-5" />, title: 'Approved Applicants Only', body: 'Members submit an application and wait for approval. No instant signups, no throwaway accounts.' },
              { icon: <TrendingUp className="w-5 h-5" />, title: 'High Purchase Intent', body: 'A member who got approved and logged in is there specifically to spend money on creators they like.' },
              { icon: <MessageCircle className="w-5 h-5" />, title: 'Direct Messaging', body: 'Fans can message you directly. You can charge for custom requests — all through the platform.' },
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

      {/* ─── CTA ─── */}
      <section className="py-32 relative overflow-hidden border-t border-gold-border/30">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gold/4 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Crown className="w-10 h-10 text-gold mx-auto mb-6 opacity-80" />
          <span className="section-eyebrow">Ready to Apply?</span>
          <h2 className="font-serif text-4xl sm:text-5xl text-white mt-4 mb-5 leading-tight">
            Start Earning on<br />
            <em className="text-gradient-gold not-italic">Your Own Terms.</em>
          </h2>
          <p className="text-arc-secondary text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Applications are reviewed manually. Spots are limited. If you're a verified creator
            who wants a private platform that pays 70% on every transaction — apply now.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/apply-creator" className="btn-gold px-8 py-4 text-base">
              Apply as a Creator <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/explore" className="btn-outline px-8 py-4 text-base">
              Explore the Platform
            </Link>
          </div>
          <div className="mt-12 divider-gold" />
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-arc-muted">
            {['18+ Only', 'Age Verification Required', 'Secure · Private · Encrypted'].map((label) => (
              <span key={label} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-gold/60" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
