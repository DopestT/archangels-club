import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft, AlertCircle, MessageSquare, CheckCircle, RefreshCw, Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/api';

interface ContentItem {
  id: string;
  title: string;
  description: string;
  content_type: string;
  access_type: 'free' | 'locked' | 'subscribers';
  price: number;
  status: string;
  rejection_reason?: string | null;
  moderation_note?: string | null;
  preview_url?: string | null;
  created_at: string;
}

export default function CreatorEditContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();

  const stateItem = (location.state as { item?: ContentItem } | null)?.item ?? null;

  const [item, setItem] = useState<ContentItem | null>(stateItem);
  const [loading, setLoading] = useState(!stateItem);
  const [loadError, setLoadError] = useState('');

  const [title, setTitle] = useState(stateItem?.title ?? '');
  const [description, setDescription] = useState(stateItem?.description ?? '');
  const [accessType, setAccessType] = useState<'free' | 'locked' | 'subscribers'>(
    stateItem?.access_type ?? 'locked'
  );
  const [price, setPrice] = useState(String(stateItem?.price ?? ''));

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (stateItem || !id) return;
    setLoading(true);
    fetch(`${API_BASE}/api/content/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setLoadError('Content not found.'); return; }
        setItem(data);
        setTitle(data.title ?? '');
        setDescription(data.description ?? '');
        setAccessType(data.access_type ?? 'locked');
        setPrice(String(data.price ?? ''));
      })
      .catch(() => setLoadError('Failed to load content.'))
      .finally(() => setLoading(false));
  }, [id, stateItem, token]);

  async function handleSubmit() {
    if (!title.trim()) return;
    if (accessType === 'locked') {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0.99) {
        setSubmitError('Please set a price of at least $0.99 for locked content.');
        return;
      }
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${API_BASE}/api/content/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          access_type: accessType,
          price: accessType === 'locked' ? parseFloat(price) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Failed to resubmit. Please try again.');
        return;
      }
      navigate('/creator/media', { state: { resubmitted: data.resubmitted ?? true } });
    } catch {
      setSubmitError('Unable to reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const status = item?.status;
  const feedbackText = item?.rejection_reason ?? item?.moderation_note;

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

        <Link
          to="/creator/media"
          className="inline-flex items-center gap-2 text-sm text-arc-muted hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Library
        </Link>

        {loading && (
          <div className="space-y-4 py-4 animate-pulse">
            <div className="h-16 rounded-xl bg-white/5" />
            <div className="h-6 w-40 rounded bg-white/5" />
            <div className="h-4 w-56 rounded bg-white/5" />
            <div className="h-10 rounded-lg bg-white/5 mt-6" />
            <div className="h-24 rounded-lg bg-white/5" />
            <div className="h-20 rounded-xl bg-white/5" />
          </div>
        )}

        {loadError && (
          <div className="p-4 rounded-xl bg-arc-error/10 border border-arc-error/30 text-sm text-arc-error">
            {loadError}
          </div>
        )}

        {item && !loading && (
          <>
            {/* Status context banner */}
            {status === 'changes_requested' && (
              <div className="mb-6 p-4 rounded-xl bg-amber-400/5 border border-amber-400/20">
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-400 mb-1">The review team left feedback</p>
                    {feedbackText && (
                      <p className="text-xs text-arc-secondary leading-relaxed mb-2">{feedbackText}</p>
                    )}
                    <p className="text-xs text-arc-muted">Make the changes below then resubmit for review.</p>
                  </div>
                </div>
              </div>
            )}

            {status === 'rejected' && (
              <div className="mb-6 p-4 rounded-xl bg-arc-error/5 border border-arc-error/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-arc-error flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-arc-error mb-1">This drop wasn't approved</p>
                    {feedbackText && (
                      <p className="text-xs text-arc-secondary leading-relaxed mb-2">{feedbackText}</p>
                    )}
                    <p className="text-xs text-arc-muted">
                      Revise below and resubmit, or{' '}
                      <Link to="/upload" className="text-gold hover:underline">start a fresh drop</Link>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status === 'failed_processing' && (
              <div className="mb-6 p-4 rounded-xl bg-amber-400/5 border border-amber-400/20">
                <div className="flex items-start gap-3">
                  <RefreshCw className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-400 mb-1">Processing didn't complete</p>
                    <p className="text-xs text-arc-muted">Your drop details are preserved — resubmit to try again.</p>
                  </div>
                </div>
              </div>
            )}

            <h1 className="font-serif text-2xl text-white mb-1">Edit Drop</h1>
            <p className="text-sm text-arc-muted mb-8">
              {status === 'changes_requested'
                ? 'Make the requested changes below, then resubmit for review.'
                : status === 'rejected'
                ? 'Revise your drop based on the feedback above and resubmit.'
                : status === 'failed_processing'
                ? 'Confirm your details below and resubmit to try again.'
                : 'Update your content and resubmit for review.'}
            </p>

            {/* Content type (read-only) */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-arc-secondary uppercase tracking-wider mb-2">
                Content Type
              </label>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-arc-secondary capitalize">
                  {item.content_type}
                </span>
                <span className="text-xs text-arc-muted">Cannot be changed after upload</span>
              </div>
            </div>

            {/* Title */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-arc-secondary uppercase tracking-wider mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={120}
                className="input-dark w-full"
                placeholder="Give your drop a title…"
              />
            </div>

            {/* Description */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-arc-secondary uppercase tracking-wider mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                maxLength={1000}
                className="input-dark w-full resize-none"
                placeholder="Describe this drop for your fans…"
              />
            </div>

            {/* Access type */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-arc-secondary uppercase tracking-wider mb-3">
                Access
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  { value: 'locked', label: 'Locked', sub: 'Pay to unlock' },
                  { value: 'subscribers', label: 'Subscribers', sub: 'Sub-only' },
                  { value: 'free', label: 'Free', sub: 'Everyone' },
                ] as const).map(({ value, label, sub }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAccessType(value)}
                    className={`p-3 rounded-xl border text-left transition-all flex sm:block items-center gap-3 ${
                      accessType === value
                        ? 'border-gold/50 bg-gold/5'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <p className={`text-sm font-medium ${accessType === value ? 'text-gold' : 'text-white'}`}>
                      {label}
                    </p>
                    <p className="text-xs text-arc-muted sm:mt-0.5">{sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            {accessType === 'locked' && (
              <div className="mb-8">
                <label className="block text-xs font-medium text-arc-secondary uppercase tracking-wider mb-2">
                  Price (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-arc-muted text-sm pointer-events-none">
                    $
                  </span>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    min="0.99"
                    max="999"
                    step="0.01"
                    className="input-dark w-full pl-7"
                    placeholder="4.99"
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {submitError && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-arc-error/10 border border-arc-error/30 mb-6">
                <AlertCircle className="w-4 h-4 text-arc-error flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-arc-error">{submitError}</p>
                  <p className="text-xs text-arc-muted mt-1">Your edits are still here — try again when ready.</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pb-10">
              <Link
                to="/creator/media"
                className="btn-outline px-5 py-3.5 text-sm flex-shrink-0"
              >
                Cancel
              </Link>
              <button
                onClick={handleSubmit}
                disabled={submitting || !title.trim()}
                className="btn-gold flex-1 py-3.5 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Clock className="w-4 h-4 animate-pulse" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Resubmit for Review
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
