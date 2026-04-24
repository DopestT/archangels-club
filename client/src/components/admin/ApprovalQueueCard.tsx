import React, { useState } from 'react';
import { Check, X, MessageSquare, User, Image, Briefcase } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { timeAgo } from '../../lib/utils';

type QueueItemType = 'user' | 'creator' | 'content';

interface ApprovalQueueCardProps {
  id: string;
  type: QueueItemType;
  name: string;
  username?: string;
  avatarUrl?: string;
  submittedAt: string;
  reason?: string;
  previewUrl?: string;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
  extra?: Record<string, string>;
}

const TYPE_CONFIG: Record<QueueItemType, { icon: React.ReactNode; label: string }> = {
  user:    { icon: <User className="w-3.5 h-3.5" />,      label: 'Access Request' },
  creator: { icon: <Briefcase className="w-3.5 h-3.5" />, label: 'Creator Application' },
  content: { icon: <Image className="w-3.5 h-3.5" />,     label: 'Content Review' },
};

export default function ApprovalQueueCard({ id, type, name, username, avatarUrl, submittedAt, reason, previewUrl, onApprove, onReject, extra }: ApprovalQueueCardProps) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const cfg = TYPE_CONFIG[type];

  async function handleApprove() {
    setLoading('approve');
    try { await onApprove(id); } finally { setLoading(null); }
  }
  async function handleReject() {
    if (!showRejectInput) { setShowRejectInput(true); return; }
    setLoading('reject');
    try { await onReject(id, rejectReason || undefined); } finally { setLoading(null); setShowRejectInput(false); }
  }

  return (
    <div className="card-surface rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-white/10" />
        ) : (
          <Avatar src={avatarUrl} name={name} size="md" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-medium text-white">{name}</p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/25 text-amber-400">
              {cfg.icon} {cfg.label}
            </span>
          </div>
          {username && <p className="text-xs text-arc-muted">@{username}</p>}
          <p className="text-xs text-arc-muted mt-0.5">{timeAgo(submittedAt)}</p>
        </div>
      </div>

      {/* Reason / pitch */}
      {reason && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-bg-hover border border-white/5 mb-4">
          <MessageSquare className="w-3.5 h-3.5 text-arc-muted flex-shrink-0 mt-0.5" />
          <p className="text-xs text-arc-secondary leading-relaxed">{reason}</p>
        </div>
      )}

      {/* Extra metadata */}
      {extra && Object.keys(extra).length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {Object.entries(extra).map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] text-arc-muted uppercase tracking-wide">{k}</p>
              <p className="text-xs text-arc-secondary">{v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reject reason input */}
      {showRejectInput && (
        <textarea
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
          placeholder="Reason for rejection (optional)"
          className="w-full bg-bg-hover border border-arc-error/30 rounded-lg px-3 py-2 text-sm text-white placeholder-arc-muted outline-none resize-none mb-3 min-h-16"
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button onClick={handleApprove} disabled={loading !== null} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-arc-success/10 border border-arc-success/25 text-arc-success text-sm font-medium hover:bg-arc-success/20 transition-all disabled:opacity-50">
          {loading === 'approve' ? <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <Check className="w-3.5 h-3.5" />}
          {loading === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        <button onClick={handleReject} disabled={loading !== null} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-50 ${showRejectInput ? 'bg-arc-error/10 border-arc-error/25 text-arc-error hover:bg-arc-error/20' : 'border-white/10 text-arc-secondary hover:border-arc-error/30 hover:text-arc-error'}`}>
          {loading === 'reject' ? <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <X className="w-3.5 h-3.5" />}
          {loading === 'reject' ? 'Rejecting…' : showRejectInput ? 'Confirm Reject' : 'Reject'}
        </button>
        {showRejectInput && (
          <button onClick={() => setShowRejectInput(false)} className="px-3 py-2 text-xs text-arc-muted hover:text-white transition-colors">Cancel</button>
        )}
      </div>
    </div>
  );
}
