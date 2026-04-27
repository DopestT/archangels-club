import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/utils';
import { API_BASE } from '../lib/api';


interface SessionInfo {
  status: string;
  payment_status: string;
  type: string;
  content_id: string | null;
  creator_id: string | null;
  amount: number | null;
}

interface Props {
  type: 'success' | 'cancel';
}

export default function PaymentResultPage({ type }: Props) {
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const [session, setSession]   = useState<SessionInfo | null>(null);
  const [loading, setLoading]   = useState(type === 'success');
  const isSuccess = type === 'success';
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!isSuccess || !sessionId || !token) { setLoading(false); return; }
    fetch(`${API_BASE}/api/checkout/session/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => { if (!data.error) setSession(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isSuccess, sessionId, token]);

  if (isSuccess && loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  const successMessage =
    session?.type === 'unlock'       ? 'Your content has been unlocked. Enjoy your drop.' :
    session?.type === 'tip'          ? 'Your tip has been sent. Thank you for your support.' :
    session?.type === 'subscription' ? 'Your subscription is now active. Enjoy exclusive access.' :
                                       'Your payment is confirmed.';

  const backLink = (session?.type === 'unlock' && session.content_id)
    ? { to: `/content/${session.content_id}?unlocked=true`, label: 'View Unlocked Content' }
    : (session?.type === 'tip' || session?.type === 'subscription')
    ? { to: '/explore', label: 'Back to Explore' }
    : null;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {isSuccess ? (
          <CheckCircle className="w-16 h-16 text-gold mx-auto mb-6" />
        ) : (
          <XCircle className="w-16 h-16 text-arc-secondary mx-auto mb-6" />
        )}

        <h1 className="font-serif text-3xl text-white mb-3">
          {isSuccess ? 'Payment Successful' : 'Payment Cancelled'}
        </h1>

        <p className="text-arc-secondary mb-6">
          {isSuccess ? successMessage : 'Your payment was cancelled. No charge was made.'}
        </p>

        {isSuccess && session?.amount != null && (
          <p className="text-gold font-serif text-xl mb-6">{formatCurrency(session.amount)}</p>
        )}

        <div className="flex items-center justify-center gap-4 flex-wrap">
          {backLink && (
            <Link to={backLink.to} className="btn-gold">{backLink.label}</Link>
          )}
          <Link to="/dashboard" className={backLink ? 'btn-outline' : 'btn-gold'}>
            Dashboard
          </Link>
          {!isSuccess && (
            <Link to="/explore" className="btn-outline">Browse Drops</Link>
          )}
        </div>
      </div>
    </div>
  );
}
