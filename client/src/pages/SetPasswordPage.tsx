import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Crown, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { API_BASE } from '../lib/api';


export default function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-arc-error mx-auto mb-4" />
          <h1 className="font-serif text-2xl text-white mb-2">Invalid Link</h1>
          <p className="text-arc-secondary mb-6">This link is missing a token. Use the link from your approval email.</p>
          <Link to="/login" className="btn-gold">Go to Login</Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return; }
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-arc-success/10 border border-arc-success/30 flex items-center justify-center mx-auto mb-8">
            <CheckCircle className="w-9 h-9 text-arc-success" />
          </div>
          <h1 className="font-serif text-3xl text-white mb-3">Password set.</h1>
          <p className="text-arc-secondary mb-6">You can now log in with your email and new password.</p>
          <Link to="/login" className="btn-gold">Sign In →</Link>
          <p className="text-xs text-arc-muted mt-4">Redirecting automatically in 3 seconds…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded bg-gold-gradient flex items-center justify-center shadow-gold mx-auto mb-5">
            <Crown className="w-6 h-6 text-bg-primary" />
          </div>
          <p className="section-eyebrow mb-3">Archangels Club</p>
          <h1 className="font-serif text-3xl text-white mb-2">Set your password</h1>
          <p className="text-arc-secondary text-sm">Choose a strong password to activate your account.</p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-arc-error/10 border border-arc-error/30 mb-5">
            <p className="text-xs text-arc-error">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-arc-secondary mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="input-dark pr-11"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-arc-muted hover:text-white"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-arc-secondary mb-1.5">Confirm Password</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              className={`input-dark ${confirm && confirm !== password ? 'border-arc-error/50' : ''}`}
              required
            />
            {confirm && confirm !== password && (
              <p className="text-xs text-arc-error mt-1">Passwords don't match</p>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn-gold w-full py-3.5 text-sm mt-2">
            {loading ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : 'Activate Account →'}
          </button>
        </form>

        <p className="text-center text-xs text-arc-muted mt-6">
          Already have a password? <Link to="/login" className="text-gold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
