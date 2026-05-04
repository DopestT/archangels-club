import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Shield, Crown, AlertCircle } from 'lucide-react';
import { API_BASE } from '../lib/api';

export default function MagicLoginPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('No login token found. Request a new magic link from the login page.');
      setStatus('error');
      return;
    }

    fetch(`${API_BASE}/api/auth/magic-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setStatus('error');
          return;
        }
        // Store auth and reload so AuthContext re-initializes
        localStorage.setItem('arc_auth', JSON.stringify({ token: data.token, user: data.user }));
        window.location.href = data.user?.role === 'admin' || data.user?.role === 'creator' ? '/creator' : '/dashboard';
      })
      .catch(() => {
        setError('Unable to reach the server. Please try again.');
        setStatus('error');
      });
  }, [token]);

  if (status === 'verifying') {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-5" />
          <p className="font-serif text-xl text-white mb-1">Verifying your link</p>
          <p className="text-xs text-arc-muted">Logging you in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-arc-error/10 border border-arc-error/30 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-7 h-7 text-arc-error" />
        </div>
        <h2 className="font-serif text-2xl text-white mb-2">Link expired or invalid</h2>
        <p className="text-sm text-arc-secondary mb-6 leading-relaxed">{error}</p>
        <Link to="/login" className="btn-gold w-full py-3 inline-flex items-center justify-center gap-2">
          <Shield className="w-4 h-4" />
          Back to Login
        </Link>
      </div>
    </div>
  );
}
