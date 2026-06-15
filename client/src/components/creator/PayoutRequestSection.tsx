import React, { useState, useEffect } from 'react';
import { DollarSign, ChevronRight, Clock, CheckCircle, XCircle, Send } from 'lucide-react';
import { API_BASE } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';

interface PayoutRequest {
  id: string;
  amount_dollars: string;
  payment_method: string;
  notes: string;
  status: 'pending' | 'paid' | 'rejected';
  admin_note: string;
  created_at: string;
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  paypal: 'PayPal',
  venmo: 'Venmo',
  zelle: 'Zelle',
  check: 'Check',
  other: 'Other',
};

function timeAgoShort(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 30) return new Date(iso).toLocaleDateString();
  if (d > 0) return `${d}d ago`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h ago`;
  return 'just now';
}

export default function PayoutRequestSection({
  token,
  totalEarnings,
}: {
  token: string | null;
  totalEarnings: number;
}) {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [notes, setNotes] = useState('');

  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    fetch(`${API_BASE}/api/creators/payout-requests`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRequests(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, token]);

  async function submit() {
    setError(null);
    const dollars = parseFloat(amount);
    if (!dollars || dollars < 10) {
      setError('Minimum payout request is $10.00.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/creators/payout-requests`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_dollars: dollars, payment_method: method, notes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to submit.'); return; }
      setRequests(prev => [
        {
          id: data.id,
          amount_dollars: String(dollars),
          payment_method: method,
          notes,
          status: 'pending',
          admin_note: '',
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setAmount('');
      setNotes('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="card-surface rounded-xl mb-5 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <DollarSign className="w-4 h-4 text-gold/70" />
          <span className="font-serif text-base text-white">Request Payout</span>
          {pendingCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/25">
              {pendingCount} pending
            </span>
          )}
        </div>
        <ChevronRight
          className={`w-4 h-4 text-arc-muted transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-white/5">
          {/* ── Form ── */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-xs text-arc-secondary leading-relaxed">
              Request a manual payout. We'll process it within 3–5 business days and confirm via email.
              Your available balance is{' '}
              <span className="text-gold font-medium">{formatCurrency(totalEarnings)}</span>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-arc-secondary mb-1.5">Amount ($)</label>
                <input
                  type="number"
                  min={10}
                  step={0.01}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="input-dark"
                />
                <p className="text-[11px] text-arc-muted mt-1">Minimum $10.00</p>
              </div>
              <div>
                <label className="block text-xs text-arc-secondary mb-1.5">Payment Method</label>
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value)}
                  className="input-dark"
                >
                  {Object.entries(METHOD_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-arc-secondary mb-1.5">
                Notes <span className="text-arc-muted">(optional — e.g. PayPal email, bank details)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add payment details or any notes…"
                rows={2}
                maxLength={500}
                className="w-full bg-bg-hover border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-arc-muted resize-none focus:outline-none focus:border-gold/40 transition-colors"
              />
            </div>

            {error && <p className="text-xs text-arc-error">{error}</p>}
            {success && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-arc-success/8 border border-arc-success/25">
                <CheckCircle className="w-4 h-4 text-arc-success flex-shrink-0" />
                <p className="text-xs text-arc-success">
                  Payout request submitted. We'll confirm via email within 3–5 business days.
                </p>
              </div>
            )}

            <button
              onClick={submit}
              disabled={submitting || !amount}
              className="btn-gold text-xs px-5 py-2.5 flex items-center gap-2 disabled:opacity-40"
            >
              {submitting ? (
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>

          {/* ── History ── */}
          {(loading || requests.length > 0) && (
            <div className="border-t border-white/5 px-6 py-4">
              <p className="text-xs font-medium text-arc-secondary mb-3">Request History</p>
              {loading ? (
                <p className="text-xs text-arc-muted">Loading…</p>
              ) : (
                <div className="space-y-2">
                  {requests.map(r => (
                    <div
                      key={r.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-bg-hover border border-white/5"
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {r.status === 'paid'     && <CheckCircle className="w-4 h-4 text-arc-success" />}
                        {r.status === 'rejected' && <XCircle     className="w-4 h-4 text-arc-error" />}
                        {r.status === 'pending'  && <Clock       className="w-4 h-4 text-amber-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">
                            {formatCurrency(parseFloat(r.amount_dollars))}
                          </span>
                          <span className="text-[10px] text-arc-muted">
                            {METHOD_LABELS[r.payment_method] ?? r.payment_method}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                              r.status === 'paid'
                                ? 'bg-arc-success/10 text-arc-success border-arc-success/25'
                                : r.status === 'rejected'
                                ? 'bg-arc-error/10 text-arc-error border-arc-error/20'
                                : 'bg-amber-400/10 text-amber-400 border-amber-400/25'
                            }`}
                          >
                            {r.status}
                          </span>
                          <span className="text-[10px] text-arc-muted ml-auto">{timeAgoShort(r.created_at)}</span>
                        </div>
                        {r.notes && (
                          <p className="text-[11px] text-arc-muted mt-1 truncate">{r.notes}</p>
                        )}
                        {r.admin_note && (
                          <p className="text-[11px] text-arc-secondary mt-1">
                            <span className="text-arc-muted">Admin: </span>{r.admin_note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
