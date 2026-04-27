import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Crown, Clock, Check, AlertCircle, Image, Video, Music, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/utils';
import { API_BASE } from '../lib/api';


const CONTENT_CATEGORIES = [
  { id: 'image', icon: <Image className="w-4 h-4" />, label: 'Images' },
  { id: 'video', icon: <Video className="w-4 h-4" />, label: 'Videos' },
  { id: 'audio', icon: <Music className="w-4 h-4" />, label: 'Audio' },
  { id: 'text', icon: <FileText className="w-4 h-4" />, label: 'Written' },
];

export default function CreatorApplicationPage() {
  const { user, token } = useAuth();

  const [bio, setBio] = useState('');
  const [tags, setTags] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [subscriptionPrice, setSubscriptionPrice] = useState('19.99');
  const [startingPrice, setStartingPrice] = useState('7.99');
  const [pitch, setPitch] = useState('');
  const [idConfirmed, setIdConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  function toggleCategory(id: string) {
    setCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function validate() {
    const errs: string[] = [];
    if (!bio || bio.length < 50) errs.push('Bio must be at least 50 characters.');
    if (!tags.trim()) errs.push('At least one tag / niche is required.');
    if (categories.length === 0) errs.push('Select at least one content category.');
    if (!pitch || pitch.length < 80) errs.push('Pitch must be at least 80 characters.');
    if (!idConfirmed) errs.push('You must confirm your identity can be verified.');
    if (!termsAccepted) errs.push('You must accept the Creator Terms.');
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/creators/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          bio,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          categories,
          subscription_price: parseFloat(subscriptionPrice),
          starting_price: parseFloat(startingPrice),
          pitch,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors([data.error ?? 'Something went wrong. Please try again.']);
        return;
      }
      setSubmitted(true);
    } catch {
      setErrors(['Unable to reach the server. Please check your connection.']);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-8">
            <Clock className="w-9 h-9 text-amber-400" />
          </div>
          <span className="section-eyebrow mb-4 block">Application Submitted</span>
          <h1 className="font-serif text-3xl text-white mb-4">Under Review</h1>
          <p className="text-arc-secondary leading-relaxed mb-6">
            Your creator application has been submitted. Our team reviews all applications manually. You'll receive an email within <strong className="text-white">48–72 hours</strong>.
          </p>
          <div className="card-surface p-5 rounded-xl text-left mb-6 space-y-3">
            <p className="text-xs font-medium text-gold">What happens next:</p>
            {[
              'Our team reviews your bio, pitch, and content plan',
              'Identity verification will be requested via email',
              'If approved, your creator profile goes live immediately',
              'You can upload content right away — it enters content review',
            ].map((step) => (
              <div key={step} className="flex items-start gap-2.5 text-xs text-arc-secondary">
                <Check className="w-3.5 h-3.5 text-gold flex-shrink-0 mt-0.5" />
                {step}
              </div>
            ))}
          </div>
          <Link to="/dashboard" className="btn-outline w-full">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary py-10">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-arc-secondary hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>

        <div className="mb-8">
          <p className="section-eyebrow mb-2">Creator Programme</p>
          <h1 className="font-serif text-3xl text-white">Apply to Become a Creator</h1>
          <p className="text-arc-secondary text-sm mt-2">
            Welcome, {user?.display_name}. Fill out this application to start publishing private content.
            All creator applications are manually reviewed before approval.
          </p>
        </div>

        {/* Notice */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/20 mb-8">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-300 mb-1">Creator Verification Required</p>
            <p className="text-xs text-arc-muted leading-relaxed">
              All creators must verify their identity (government-issued ID) and be 18+. Creators are responsible for ensuring all content meets our guidelines. Violations result in immediate suspension.
            </p>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="p-4 rounded-xl bg-arc-error/10 border border-arc-error/30 mb-6 space-y-1">
            {errors.map((e) => <p key={e} className="text-xs text-arc-error">{e}</p>)}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Bio */}
          <div className="card-surface p-6 rounded-xl">
            <h3 className="font-serif text-lg text-white mb-4">Creator Profile</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-arc-secondary mb-1.5">
                  Creator Bio *
                  <span className="text-arc-muted ml-1">(min. 50 characters)</span>
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell potential subscribers who you are, what you create, and what makes your content exclusive…"
                  className="input-dark min-h-28 resize-y"
                  maxLength={600}
                />
                <p className="text-xs text-arc-muted mt-1 text-right">{bio.length}/600</p>
              </div>

              <div>
                <label className="block text-xs text-arc-secondary mb-1.5">
                  Niches / Tags *
                  <span className="text-arc-muted ml-1">(comma-separated, e.g. Photography, Fashion, Art)</span>
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Photography, Fashion, Art"
                  className="input-dark"
                />
              </div>

              <div>
                <label className="block text-xs text-arc-secondary mb-2">Content Categories *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CONTENT_CATEGORIES.map(({ id, icon, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleCategory(id)}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-sans transition-all ${
                        categories.includes(id)
                          ? 'bg-gold-muted border-gold text-gold'
                          : 'border-white/10 text-arc-secondary hover:border-gold/30 hover:text-white'
                      }`}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="card-surface p-6 rounded-xl">
            <h3 className="font-serif text-lg text-white mb-4">Proposed Pricing</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-arc-secondary mb-1.5">Monthly Subscription Price</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-arc-muted text-sm">$</span>
                  <input
                    type="number"
                    value={subscriptionPrice}
                    onChange={(e) => setSubscriptionPrice(e.target.value)}
                    min="4.99"
                    step="0.01"
                    className="input-dark pl-8"
                  />
                </div>
                <p className="text-xs text-arc-muted mt-1">You receive {formatCurrency(parseFloat(subscriptionPrice || '0') * 0.8)}/mo per subscriber</p>
              </div>
              <div>
                <label className="block text-xs text-arc-secondary mb-1.5">Starting / Unlock Price</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-arc-muted text-sm">$</span>
                  <input
                    type="number"
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(e.target.value)}
                    min="1.99"
                    step="0.01"
                    className="input-dark pl-8"
                  />
                </div>
                <p className="text-xs text-arc-muted mt-1">Minimum per-content unlock price</p>
              </div>
            </div>
            <p className="text-xs text-arc-muted mt-4">
              Platform fee: 20% · Payouts processed weekly · Minimum payout $50
            </p>
          </div>

          {/* Pitch */}
          <div className="card-surface p-6 rounded-xl">
            <h3 className="font-serif text-lg text-white mb-1">Your Pitch</h3>
            <p className="text-xs text-arc-secondary mb-4">
              Tell our team why you belong on Archangels Club. What's your audience? What will you offer that they can't find anywhere else?
            </p>
            <textarea
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              placeholder="Make the case for yourself. Our team reads every word."
              className="input-dark min-h-28 resize-y"
              maxLength={800}
            />
            <p className="text-xs text-arc-muted mt-1 text-right">{pitch.length}/800</p>
          </div>

          {/* Agreements */}
          <div className="card-surface p-6 rounded-xl space-y-4">
            <h3 className="font-serif text-lg text-white mb-2">Confirmations</h3>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={idConfirmed}
                onChange={(e) => setIdConfirmed(e.target.checked)}
                className="mt-0.5 accent-gold"
              />
              <span className="text-xs text-arc-secondary leading-relaxed">
                I confirm I am <strong className="text-white">18 years or older</strong> and understand that government-issued photo ID verification will be required before my creator account is activated.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 accent-gold"
              />
              <span className="text-xs text-arc-secondary leading-relaxed">
                I accept the <Link to="/terms" className="text-gold hover:underline">Creator Terms of Service</Link>, understand the platform content policies, and confirm that all content I upload will comply with applicable laws and platform guidelines.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-gold w-full py-4 text-base"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : <Crown className="w-5 h-5" />}
            {loading ? 'Submitting…' : 'Submit Creator Application'}
          </button>
        </form>
      </div>
    </div>
  );
}
