import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Crown, Lock, Shield, Eye, EyeOff, Clock, Mail, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

type Mode = 'login' | 'signup';

export default function AuthPage({ mode }: { mode: Mode }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // shared
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // login only
  const [role, setRole] = useState<UserRole>('fan');

  // signup only
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [reason, setReason] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);

  const from = (location.state as { from?: string })?.from ?? '/dashboard';

  function ageFromDOB(dob: string): number {
    const today = new Date();
    const birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  function validateLogin(): string[] {
    const errs: string[] = [];
    if (!email || !email.includes('@')) errs.push('A valid email address is required.');
    if (!password) errs.push('Password is required.');
    return errs;
  }

  function validateSignup(): string[] {
    const errs: string[] = [];
    if (!email || !email.includes('@')) errs.push('A valid email address is required.');
    if (!username || username.length < 3) errs.push('Username must be at least 3 characters.');
    if (/\s/.test(username)) errs.push('Username cannot contain spaces.');
    if (!password || password.length < 8) errs.push('Password must be at least 8 characters.');
    if (password !== confirmPassword) errs.push('Passwords do not match.');
    if (!dateOfBirth) errs.push('Date of birth is required.');
    else if (ageFromDOB(dateOfBirth) < 18) errs.push('You must be 18 or older to join.');
    if (!reason || reason.trim().length < 20) errs.push('Please tell us your reason for joining (min. 20 characters).');
    if (!ageConfirmed) errs.push('You must confirm you are 18 or older.');
    if (!termsAccepted) errs.push('You must accept the Terms of Service.');
    return errs;
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateLogin();
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setLoading(true);
    setTimeout(() => {
      login(role, role === 'admin' ? 'approved' : 'approved');
      navigate(from, { replace: true });
    }, 900);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateSignup();
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://archangels-club-production.up.railway.app';
      console.log('Submitting access request to:', `${apiUrl}/api/access-request`);
      const res = await fetch(`${apiUrl}/api/access-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: username, reason }),
      });
      console.log('Access request response:', res.status);
      const data = await res.json();
      if (!res.ok) {
        setErrors([data.error ?? 'Something went wrong. Please try again.']);
        return;
      }
      setSignupComplete(true);
    } catch {
      setErrors(['Unable to reach the server. Please check your connection and try again.']);
    } finally {
      setLoading(false);
    }
  }

  // ─── Signup success / pending state ───────────────────────────────────────
  if (mode === 'signup' && signupComplete) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-8">
            <Clock className="w-9 h-9 text-amber-400" />
          </div>

          <span className="section-eyebrow mb-4 block">Request Received</span>

          <h1 className="font-serif text-3xl text-white mb-4 leading-snug">
            Your request has been<br />received.
          </h1>

          <p className="text-arc-secondary leading-relaxed mb-6">
            Access is reviewed before approval. This is not an open platform — every member is vetted manually.
          </p>

          <div className="card-surface p-6 rounded-xl text-left mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-4 h-4 text-gold" />
              <p className="text-sm font-medium text-white">What happens next</p>
            </div>
            <div className="space-y-3">
              {[
                'Our team reviews your application within 24–48 hours.',
                `An email will be sent to ${email} with our decision.`,
                'If approved, you can sign in immediately.',
                'If we need more information, we\'ll reach out.',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 text-xs text-arc-secondary">
                  <span className="font-serif text-gold/50 flex-shrink-0 w-4">{i + 1}.</span>
                  {step}
                </div>
              ))}
            </div>
          </div>

          <div className="divider-gold mb-6" />

          <p className="text-xs text-arc-muted mb-4">
            Already received your approval?
          </p>
          <Link to="/login" className="btn-gold w-full">
            Sign In
          </Link>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 mt-4 text-sm text-arc-muted hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to homepage
          </Link>
        </div>
      </div>
    );
  }

  // ─── Shared left panel ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-bg-surface border-r border-gold-border/40 p-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gold/4 rounded-full blur-3xl" />
        </div>
        <div className="relative">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-gold-gradient flex items-center justify-center shadow-gold-sm">
              <Crown className="w-4 h-4 text-bg-primary" />
            </div>
            <span className="font-serif text-xl text-white">Archangels Club</span>
          </Link>
        </div>
        <div className="relative">
          <h2 className="font-serif text-4xl text-white mb-4 leading-tight">
            {mode === 'login' ? (
              <>Access Is<br /><em className="text-gradient-gold not-italic">Earned.</em></>
            ) : (
              <>Entry Begins<br /><em className="text-gradient-gold not-italic">Here.</em></>
            )}
          </h2>
          <p className="text-arc-secondary leading-relaxed max-w-sm mb-8">
            {mode === 'login'
              ? 'Welcome back. Sign in to your private account and pick up where you left off.'
              : 'Submit your access request. Our team reviews every application. Not everyone gets in — that\'s the point.'}
          </p>
          <div className="space-y-3">
            {[
              { icon: <Lock className="w-4 h-4" />, text: mode === 'login' ? 'Your account is private and gated' : 'All new accounts are pending by default' },
              { icon: <Shield className="w-4 h-4" />, text: mode === 'login' ? 'End-to-end encrypted sessions' : 'Manual review within 24–48 hours' },
              { icon: <Crown className="w-4 h-4" />, text: mode === 'login' ? 'Access your subscriptions and content' : 'Members-only community after approval' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-arc-secondary">
                <span className="text-gold">{icon}</span>
                {text}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-arc-muted">18+ platform · Age verification required · All content moderated</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-start justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          {/* Mobile logo */}
          <Link to="/" className="flex lg:hidden items-center gap-2.5 mb-8 justify-center">
            <div className="w-7 h-7 rounded bg-gold-gradient flex items-center justify-center">
              <Crown className="w-4 h-4 text-bg-primary" />
            </div>
            <span className="font-serif text-lg text-white">Archangels Club</span>
          </Link>

          <h1 className="font-serif text-3xl text-white mb-2">
            {mode === 'login' ? 'Welcome Back' : 'Request Access'}
          </h1>
          <p className="text-arc-secondary text-sm mb-8">
            {mode === 'login'
              ? 'Sign in to your approved member account.'
              : 'Complete this form to submit your access request for review.'}
          </p>

          {/* Age verification banner — signup only */}
          {mode === 'signup' && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/25 mb-6">
              <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-300 mb-0.5">18+ Platform · Approval Required</p>
                <p className="text-xs text-arc-secondary leading-relaxed">
                  This platform contains adult content. All accounts are reviewed before access is granted. Submitting this form creates a <strong className="text-white">pending request</strong>, not instant access.
                </p>
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div className="p-4 rounded-xl bg-arc-error/10 border border-arc-error/30 mb-5 space-y-1">
              {errors.map((e) => <p key={e} className="text-xs text-arc-error">{e}</p>)}
            </div>
          )}

          {/* ── LOGIN FORM ──────────────────────────────────────── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-arc-secondary mb-1.5">Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="input-dark" required />
              </div>
              <div>
                <label className="block text-xs text-arc-secondary mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input-dark pr-11" required />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-arc-muted hover:text-white">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Demo shortcuts */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-xs text-arc-muted self-center">Demo login as:</span>
                {(['fan', 'creator', 'admin'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setRole(r); setEmail('demo@example.com'); setPassword('password123'); }}
                    className={`text-xs px-3 py-1 rounded-full border transition-all ${
                      role === r
                        ? 'border-gold text-gold bg-gold-muted'
                        : 'border-white/10 text-arc-muted hover:border-gold/40 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <button type="submit" disabled={loading} className="btn-gold w-full py-3.5 text-sm mt-2">
                {loading
                  ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  : 'Sign In'}
              </button>
            </form>
          )}

          {/* ── SIGNUP FORM ─────────────────────────────────────── */}
          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-arc-secondary mb-1.5">Username *</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} placeholder="yourhandle" className="input-dark" required />
                </div>
                <div>
                  <label className="block text-xs text-arc-secondary mb-1.5">Email Address *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="input-dark" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-arc-secondary mb-1.5">Password *</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 chars" className="input-dark pr-10" required />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-arc-muted hover:text-white">
                      {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-arc-secondary mb-1.5">Confirm Password *</label>
                  <div className="relative">
                    <input type={showConfirmPw ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" className={`input-dark pr-10 ${confirmPassword && confirmPassword !== password ? 'border-arc-error/50' : ''}`} required />
                    <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-arc-muted hover:text-white">
                      {showConfirmPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-xs text-arc-error mt-1">Passwords don't match</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-arc-secondary mb-1.5">Date of Birth *</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  className="input-dark"
                  required
                />
                <p className="text-xs text-arc-muted mt-1">You must be 18 or older. Date is used for age verification only.</p>
              </div>

              <div>
                <label className="block text-xs text-arc-secondary mb-1.5">
                  Reason for Joining *
                  <span className="text-arc-muted ml-1">(min. 20 characters)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Tell us why you want access to Archangels Club and which creators you're interested in…"
                  className="input-dark min-h-20 resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-arc-muted mt-1 text-right">{reason.length}/500</p>
              </div>

              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={ageConfirmed} onChange={(e) => setAgeConfirmed(e.target.checked)} className="mt-0.5 accent-gold" required />
                  <span className="text-xs text-arc-secondary leading-relaxed">
                    I confirm I am <strong className="text-white">18 years of age or older</strong> and understand this platform contains adult content.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 accent-gold" required />
                  <span className="text-xs text-arc-secondary leading-relaxed">
                    I accept the <Link to="/terms" className="text-gold hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-gold hover:underline">Privacy Policy</Link>.
                  </span>
                </label>
              </div>

              <button type="submit" disabled={loading} className="btn-gold w-full py-3.5 text-sm">
                {loading
                  ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  : 'Submit Access Request'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-arc-secondary">
            {mode === 'login' ? (
              <>No access yet?{' '}<Link to="/signup" className="text-gold hover:underline">Request Access</Link></>
            ) : (
              <>Already approved?{' '}<Link to="/login" className="text-gold hover:underline">Sign In</Link></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
