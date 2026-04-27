import React, { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/api';

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isAuthLoading, token } = useAuth();
  const ran = useRef(false);

  const sessionId = searchParams.get('session_id');
  const contentId = searchParams.get('contentId');
  const returnTo  = searchParams.get('returnTo'); // relative path, e.g. /content/abc123

  useEffect(() => {
    // Wait until auth has hydrated from localStorage before acting.
    if (isAuthLoading) return;
    // Guard against double-fire in StrictMode.
    if (ran.current) return;
    ran.current = true;

    if (!isAuthenticated) {
      const redirect = returnTo ?? (contentId ? `/content/${contentId}` : '/dashboard');
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      return;
    }

    if (!sessionId) {
      navigate('/dashboard', { replace: true });
      return;
    }

    fetch(`${API_BASE}/api/checkout/session/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        // Subscription flow: returnTo carries the content/creator path
        if (returnTo) {
          const sep = returnTo.includes('?') ? '&' : '?';
          navigate(`${returnTo}${sep}payment=success`, { replace: true });
          return;
        }
        // Unlock flow: content_id in URL or session metadata
        const resolvedContentId = contentId ?? data.content_id ?? null;
        if (resolvedContentId) {
          navigate(`/content/${resolvedContentId}?unlocked=true`, { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      })
      .catch(() => {
        if (returnTo) {
          const sep = returnTo.includes('?') ? '&' : '?';
          navigate(`${returnTo}${sep}payment=success`, { replace: true });
          return;
        }
        const fallback = contentId ? `/content/${contentId}` : '/dashboard';
        navigate(fallback, { replace: true });
      });
  }, [isAuthLoading, isAuthenticated, sessionId, contentId, returnTo, token, navigate]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center">
        <Loader className="w-8 h-8 text-gold animate-spin mx-auto mb-4" />
        <p className="text-white font-serif text-xl mb-2">Payment confirmed.</p>
        <p className="text-arc-secondary text-sm">Unlocking your content…</p>
      </div>
    </div>
  );
}
