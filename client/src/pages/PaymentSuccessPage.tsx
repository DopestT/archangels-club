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

  useEffect(() => {
    // Wait until auth has hydrated from localStorage before acting.
    if (isAuthLoading) return;
    // Guard against double-fire in StrictMode.
    if (ran.current) return;
    ran.current = true;

    if (!isAuthenticated) {
      // User's session may have expired or they opened the link in a new tab.
      // Send them to login with a redirect back to the content page.
      const redirect = contentId ? `/content/${contentId}` : '/dashboard';
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      return;
    }

    if (!sessionId) {
      // No session to verify — fall back to dashboard.
      navigate('/dashboard', { replace: true });
      return;
    }

    // Verify session with the backend, then navigate.
    fetch(`${API_BASE}/api/checkout/session/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        const resolvedContentId = contentId ?? data.content_id ?? null;
        if (resolvedContentId) {
          navigate(`/content/${resolvedContentId}?unlocked=true`, { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      })
      .catch(() => {
        // If verification fails, still send to the content page if we have the id.
        const fallback = contentId ? `/content/${contentId}` : '/dashboard';
        navigate(fallback, { replace: true });
      });
  }, [isAuthLoading, isAuthenticated, sessionId, contentId, token, navigate]);

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
