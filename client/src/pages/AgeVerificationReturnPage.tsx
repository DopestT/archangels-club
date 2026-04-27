import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Clock, Shield, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/api';

export default function AgeVerificationReturnPage() {
  const { isAuthLoading, isAuthenticated, token, ageVerificationStatus, refreshUser } = useAuth();
  const navigate = useNavigate();
  const ran = useRef(false);
  const [status, setStatus] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) { navigate('/login', { replace: true }); return; }
    if (ran.current) return;
    ran.current = true;

    // Refresh user to get the latest verification status from the DB
    refreshUser().then(() => {
      fetch(`${API_BASE}/api/verification/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => setStatus(data.age_verification_status ?? 'pending'))
        .catch(() => setStatus('pending'));
    });
  }, [isAuthLoading, isAuthenticated, token, navigate, refreshUser]);

  async function handleRetry() {
    setRetrying(true);
    try {
      const res = await fetch(`${API_BASE}/api/verification/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.already_verified) {
        await refreshUser();
        navigate('/dashboard', { replace: true });
      } else {
        setRetrying(false);
      }
    } catch {
      setRetrying(false);
    }
  }

  if (!status) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'verified') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-arc-success/15 border border-arc-success/30 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-arc-success" />
          </div>
          <h1 className="font-serif text-2xl text-white mb-2">Age Verified</h1>
          <p className="text-arc-secondary text-sm mb-6">
            Your identity has been confirmed. You now have full access to member content.
          </p>
          <button onClick={() => navigate('/dashboard', { replace: true })} className="btn-gold px-8 py-3">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-arc-error/15 border border-arc-error/30 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-arc-error" />
          </div>
          <h1 className="font-serif text-2xl text-white mb-2">Verification Failed</h1>
          <p className="text-arc-secondary text-sm mb-2">
            We were unable to confirm your identity. This may happen if the document was unclear or the details did not match.
          </p>
          <p className="text-xs text-arc-muted mb-6">
            You may try again with a different ID document. If the problem persists, contact support.
          </p>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="btn-gold px-8 py-3 gap-2 flex items-center justify-center mx-auto"
          >
            {retrying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {retrying ? 'Starting…' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  }

  // pending (default — submitted but webhook hasn't fired yet)
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-5">
          <Clock className="w-8 h-8 text-amber-400" />
        </div>
        <h1 className="font-serif text-2xl text-white mb-2">Verification Submitted</h1>
        <p className="text-arc-secondary text-sm mb-2">
          Your documents have been submitted for review. Verification typically completes within a few minutes.
        </p>
        <p className="text-xs text-arc-muted mb-6">
          Archangels Club requires age verification before restricted content can be viewed.
          Verification is handled securely by Stripe Identity.
        </p>
        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={() => refreshUser().then(() => navigate('/dashboard', { replace: true }))}
            className="btn-outline px-8 py-3"
          >
            Return to Dashboard
          </button>
          <p className="text-xs text-arc-muted">We will notify you when verification is complete.</p>
        </div>
      </div>
    </div>
  );
}
