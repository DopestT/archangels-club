import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Upload, Image, Video, Music, FileText, ArrowLeft,
  Lock, Crown, Eye, Calendar, RefreshCw, DollarSign,
  AlertCircle, Clock, CheckCircle, XCircle,
  ChevronRight, Filter, LayoutGrid,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, timeAgo } from '../lib/utils';
import { API_BASE } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaItem {
  id: string;
  title: string | null;
  description: string | null;
  content_type: string;
  access_type: string;
  preview_url: string | null;
  media_url: string | null;
  price: number | string | null;
  status: string;
  unlock_count?: number | string | null;
  created_at: string | null;
  updated_at?: string | null;
  rejection_reason?: string | null;
  moderation_note?: string | null;
  publish_at?: string | null;
  max_unlocks?: number | null;
  subscriber_discount_pct?: number | null;
}

type TabId = 'all' | 'published' | 'review' | 'scheduled' | 'drafts' | 'issues';
type TypeFilter = 'all' | 'image' | 'video' | 'audio' | 'text';
type SortBy = 'recent' | 'unlocks' | 'earning';

// ─── Static config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  approved:           { label: 'Published',        color: 'text-arc-success',   bg: 'bg-arc-success/10 border-arc-success/25' },
  pending_review:     { label: 'In Review',         color: 'text-amber-400',     bg: 'bg-amber-400/10 border-amber-400/25' },
  scheduled:          { label: 'Scheduled',         color: 'text-violet-300',    bg: 'bg-violet-500/10 border-violet-500/25' },
  rejected:           { label: 'Rejected',          color: 'text-arc-error',     bg: 'bg-arc-error/10 border-arc-error/25' },
  changes_requested:  { label: 'Changes Needed',    color: 'text-orange-400',    bg: 'bg-orange-400/10 border-orange-400/25' },
  removed:            { label: 'Removed',           color: 'text-arc-muted',     bg: 'bg-white/5 border-white/10' },
  draft:              { label: 'Draft',             color: 'text-arc-secondary', bg: 'bg-white/5 border-white/10' },
  failed_processing:  { label: 'Processing Failed', color: 'text-amber-400',    bg: 'bg-amber-400/10 border-amber-400/25' },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  image:  <Image   className="w-4 h-4" />,
  video:  <Video   className="w-4 h-4" />,
  audio:  <Music   className="w-4 h-4" />,
  text:   <FileText className="w-4 h-4" />,
};

const TYPE_LABELS: Record<string, string> = {
  image: 'Image', video: 'Video', audio: 'Audio', text: 'Text',
};

const ACCESS_CONFIG: Record<string, { label: string; color: string; borderColor: string }> = {
  locked:      { label: 'Paid',         color: 'text-gold',       borderColor: 'border-gold/30' },
  subscribers: { label: 'Subscribers',  color: 'text-violet-300', borderColor: 'border-violet-500/30' },
  free:        { label: 'Free',         color: 'text-arc-muted',  borderColor: 'border-white/10' },
};

function isIssue(status: string) {
  return ['rejected', 'changes_requested', 'removed', 'failed_processing'].includes(status);
}

function safeNum(v: number | string | null | undefined): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MediaSkeleton() {
  return (
    <div className="card-surface rounded-xl overflow-hidden">
      <div className="h-44 bg-white/5 animate-pulse" />
      <div className="p-4 space-y-2.5">
        <div className="h-4 bg-white/5 animate-pulse rounded-md w-3/4" />
        <div className="h-3 bg-white/5 animate-pulse rounded-md w-1/2" />
        <div className="h-3 bg-white/5 animate-pulse rounded-md w-1/3" />
      </div>
    </div>
  );
}

// ─── Media card ───────────────────────────────────────────────────────────────

function MediaCard({ item }: { item: MediaItem }) {
  const title       = item.title?.trim() || 'Untitled Drop';
  const unlocks     = safeNum(item.unlock_count);
  const price       = safeNum(item.price);
  const estimated   = unlocks * price * 0.8;
  const statusCfg   = STATUS_CONFIG[item.status] ?? { label: item.status, color: 'text-arc-muted', bg: 'bg-white/5 border-white/10' };
  const accessCfg   = ACCESS_CONFIG[item.access_type] ?? ACCESS_CONFIG.free;
  const typeIcon    = TYPE_ICONS[item.content_type];
  const typeLabel   = TYPE_LABELS[item.content_type] ?? item.content_type;
  const isApproved  = item.status === 'approved';
  const hasIssue    = isIssue(item.status);

  return (
    <div className="card-surface rounded-xl overflow-hidden group hover:shadow-gold transition-all duration-200 hover:-translate-y-0.5">

      {/* Thumbnail */}
      <div className="relative h-44 bg-bg-hover overflow-hidden">
        {item.preview_url ? (
          <img
            src={item.preview_url}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            style={!isApproved ? { filter: 'brightness(0.75)' } : undefined}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-arc-muted">
              {typeIcon ?? <LayoutGrid className="w-4 h-4" />}
            </div>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2.5 left-2.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusCfg.color} ${statusCfg.bg}`}>
            {item.status === 'approved'          && <CheckCircle className="w-2.5 h-2.5" />}
            {item.status === 'pending_review'    && <Clock       className="w-2.5 h-2.5" />}
            {item.status === 'scheduled'         && <Calendar    className="w-2.5 h-2.5" />}
            {item.status === 'failed_processing' && <RefreshCw   className="w-2.5 h-2.5" />}
            {hasIssue && item.status !== 'failed_processing' && <XCircle className="w-2.5 h-2.5" />}
            {statusCfg.label}
          </span>
        </div>

        {/* Content type badge — label hidden on mobile to reduce thumbnail clutter */}
        <div className="absolute top-2.5 right-2.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-primary/70 backdrop-blur-sm border border-white/10 text-[10px] text-arc-secondary">
            {typeIcon}
            <span className="hidden sm:inline">{typeLabel}</span>
          </span>
        </div>

        {/* Access badge — bottom-left */}
        {item.access_type !== 'free' && (
          <div className="absolute bottom-2.5 left-2.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-primary/70 backdrop-blur-sm border text-[10px] font-medium ${accessCfg.color} ${accessCfg.borderColor}`}>
              {item.access_type === 'locked'      && <Lock  className="w-2.5 h-2.5" />}
              {item.access_type === 'subscribers' && <Crown className="w-2.5 h-2.5" />}
              {accessCfg.label}
            </span>
          </div>
        )}

        {/* Missing media warning */}
        {isApproved && !item.media_url && (
          <div className="absolute bottom-2.5 right-2.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] text-amber-400">
              <AlertCircle className="w-2.5 h-2.5" />
              No media
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-white leading-snug line-clamp-1 mb-1 group-hover:text-gold transition-colors">
          {title}
        </h3>

        {/* Pending review reassurance */}
        {item.status === 'pending_review' && (
          <p className="text-[11px] text-arc-muted mt-0.5 mb-2 leading-relaxed">
            Typically reviewed within 24 hours.
          </p>
        )}

        {/* Scheduled publish date */}
        {item.status === 'scheduled' && item.publish_at && (
          <p className="text-[11px] text-arc-muted mt-0.5 mb-2 flex items-center gap-1">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            Publishes {new Date(item.publish_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        )}

        {/* Removed — no action available */}
        {item.status === 'removed' && (
          <p className="text-[11px] text-arc-muted mt-0.5 mb-2">
            This drop has been removed from the platform. If you believe this was in error, contact support.
          </p>
        )}

        {/* Moderation feedback — tinted by severity, clamped tighter on mobile */}
        {hasIssue && item.status !== 'failed_processing' && item.status !== 'removed' && (item.rejection_reason ?? item.moderation_note) && (
          <div className={`mt-1 mb-2.5 px-2.5 py-2 rounded-lg border ${
            item.status === 'rejected'
              ? 'bg-arc-error/5 border-arc-error/18'
              : item.status === 'changes_requested'
              ? 'bg-orange-400/5 border-orange-400/18'
              : 'bg-white/4 border-white/8'
          }`}>
            <p className="text-[10px] font-medium text-arc-muted mb-0.5">Team feedback</p>
            <p className="text-[11px] text-arc-secondary leading-relaxed line-clamp-1 sm:line-clamp-2">
              {item.rejection_reason ?? item.moderation_note}
            </p>
          </div>
        )}
        {hasIssue && item.status !== 'failed_processing' && item.status !== 'removed' && !(item.rejection_reason ?? item.moderation_note) && (
          <p className="text-[11px] text-arc-muted mt-0.5 mb-2">
            {item.status === 'changes_requested'
              ? 'Review our guidelines and revise before resubmitting.'
              : 'Edit this drop and resubmit for another look.'}
          </p>
        )}

        {/* Failed processing notice */}
        {item.status === 'failed_processing' && (
          <p className="text-[11px] text-arc-muted mt-0.5 mb-2 leading-relaxed">
            Your upload didn't finish processing. Your draft is still safe.
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[11px] text-arc-muted mt-2 pt-2 border-t border-white/5">
          {isApproved && (
            <>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {unlocks.toLocaleString()} unlock{unlocks !== 1 ? 's' : ''}
              </span>
              {estimated > 0 && (
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  ~{formatCurrency(estimated)}
                </span>
              )}
              {price > 0 && (
                <span className="ml-auto font-serif text-gold text-xs">{formatCurrency(price)}</span>
              )}
            </>
          )}
          {!isApproved && (
            <>
              <span>{item.created_at ? timeAgo(item.created_at) : 'Recently submitted'}</span>
            </>
          )}
        </div>

        {/* View link for approved content */}
        {isApproved && (
          <Link
            to={`/content/${item.id}`}
            className="flex items-center gap-1 text-[11px] text-arc-muted hover:text-gold mt-2 transition-colors"
          >
            View drop <ChevronRight className="w-3 h-3" />
          </Link>
        )}

        {/* Retry / resubmit CTAs — full-width for mobile tap targets */}
        {item.status === 'failed_processing' && (
          <Link
            to={`/creator/content/${item.id}/edit`}
            state={{ item }}
            className="mt-2.5 flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg border border-white/12 text-xs text-arc-secondary hover:text-white hover:border-white/25 hover:bg-white/4 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try uploading again
          </Link>
        )}
        {(item.status === 'changes_requested' || item.status === 'rejected') && (
          <Link
            to={`/creator/content/${item.id}/edit`}
            state={{ item }}
            className="mt-2.5 flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg border border-gold/25 text-xs text-gold/80 hover:text-gold hover:border-gold/45 hover:bg-gold/5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Edit &amp; resubmit
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

interface EmptyConfig { title: string; sub: string; showCta?: boolean }

function getEmptyConfig(tab: TabId, type: TypeFilter, hasAny: boolean): EmptyConfig {
  if (!hasAny) return {
    title: 'Your library is ready for its first drop.',
    sub: 'Upload a photo, video, or audio piece. Every great collection starts with one.',
    showCta: true,
  };
  if (tab === 'published' && type === 'all') return {
    title: 'No published drops yet.',
    sub: 'Submitted content appears here after it clears moderation review.',
  };
  if (tab === 'review') return {
    title: 'Nothing currently in review.',
    sub: 'New submissions typically clear review within 24 hours and will appear here.',
  };
  if (tab === 'scheduled') return {
    title: 'No scheduled drops.',
    sub: 'Scheduled drops appear here and go live automatically at your chosen time.',
  };
  if (tab === 'drafts') return {
    title: 'No saved drafts.',
    sub: 'Drafts you save during upload will appear here — safely stored and ready to continue.',
  };
  if (tab === 'issues') return {
    title: 'No drops need attention.',
    sub: 'All your content is in good standing.',
  };
  if (type !== 'all') return {
    title: `No ${TYPE_LABELS[type] ?? type} content in this view.`,
    sub: 'Try a different filter or tab.',
  };
  return {
    title: 'No drops match this view.',
    sub: 'Try a different filter or tab.',
  };
}

function EmptyPane({ tab, type, hasAny }: { tab: TabId; type: TypeFilter; hasAny: boolean }) {
  const { title, sub, showCta } = getEmptyConfig(tab, type, hasAny);
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-xs mx-auto">
      <div className="w-14 h-14 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center mb-5">
        <LayoutGrid className="w-6 h-6 text-gold" />
      </div>
      <h3 className="font-serif text-lg text-white mb-2">{title}</h3>
      <p className="text-sm text-arc-secondary leading-relaxed mb-6">{sub}</p>
      {showCta && (
        <Link to="/upload" className="btn-gold text-sm px-6">
          <Upload className="w-4 h-4" />
          Upload New Content
        </Link>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CreatorMediaLibrary() {
  const { user, token } = useAuth();
  const location = useLocation();
  const resubmitted = !!(location.state as { resubmitted?: boolean } | null)?.resubmitted;

  const [items,              setItems]              = useState<MediaItem[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState('');
  const [showResubmitBanner, setShowResubmitBanner] = useState(resubmitted);

  const [activeTab,   setActiveTab]   = useState<TabId>('all');
  const [typeFilter,  setTypeFilter]  = useState<TypeFilter>('all');
  const [sortBy,      setSortBy]      = useState<SortBy>('recent');

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      // Try authenticated endpoint (all statuses) first
      if (token) {
        try {
          const res = await fetch(`${API_BASE}/api/creators/my/content`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled && Array.isArray(data)) {
              setItems(data);
              setLoading(false);
              return;
            }
          }
        } catch {}
      }

      // Fall back: public endpoint via username (approved content only)
      if (user?.username) {
        try {
          const res = await fetch(`${API_BASE}/api/creators/${encodeURIComponent(user.username)}/content`);
          const data = await res.json();
          if (!cancelled && Array.isArray(data)) setItems(data);
        } catch {
          if (!cancelled) setError('Unable to load your media library.');
        }
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [token, user?.username]);

  // ── Derived counts ─────────────────────────────────────────────────────────

  const counts = useMemo(() => ({
    all:       items.length,
    published: items.filter(i => i.status === 'approved').length,
    review:    items.filter(i => i.status === 'pending_review').length,
    scheduled: items.filter(i => i.status === 'scheduled').length,
    drafts:    items.filter(i => i.status === 'draft').length,
    issues:    items.filter(i => isIssue(i.status)).length,
  }), [items]);

  // ── Filter + sort ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = items;

    if      (activeTab === 'published')  result = result.filter(i => i.status === 'approved');
    else if (activeTab === 'review')     result = result.filter(i => i.status === 'pending_review');
    else if (activeTab === 'scheduled')  result = result.filter(i => i.status === 'scheduled');
    else if (activeTab === 'drafts')     result = result.filter(i => i.status === 'draft');
    else if (activeTab === 'issues')     result = result.filter(i => isIssue(i.status));

    if (typeFilter !== 'all') result = result.filter(i => i.content_type === typeFilter);

    const copy = [...result];
    if      (sortBy === 'recent')  copy.sort((a, b) => (b.created_at ?? '') > (a.created_at ?? '') ? 1 : -1);
    else if (sortBy === 'unlocks') copy.sort((a, b) => safeNum(b.unlock_count) - safeNum(a.unlock_count));
    else if (sortBy === 'earning') {
      const earn = (i: MediaItem) => safeNum(i.unlock_count) * safeNum(i.price) * 0.8;
      copy.sort((a, b) => earn(b) - earn(a));
    }

    return copy;
  }, [items, activeTab, typeFilter, sortBy]);

  // ── Tabs config ────────────────────────────────────────────────────────────

  const TABS: { id: TabId; label: string }[] = [
    { id: 'all',       label: 'All' },
    { id: 'published', label: 'Published' },
    { id: 'review',    label: 'In Review' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'drafts',    label: 'Drafts' },
    { id: 'issues',    label: 'Issues' },
  ];

  const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
    { id: 'all',   label: 'All Types' },
    { id: 'image', label: 'Images' },
    { id: 'video', label: 'Videos' },
    { id: 'audio', label: 'Audio' },
    { id: 'text',  label: 'Text' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-primary py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Back */}
        <Link
          to="/creator"
          className="inline-flex items-center gap-2 text-sm text-arc-secondary hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Creator Studio
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="section-eyebrow mb-2">Creator Studio</p>
            <h1 className="font-serif text-3xl text-white">Media Library</h1>
            <p className="text-arc-secondary text-sm mt-1">
              {items.length > 0
                ? `${counts.published} published · ${counts.all} total`
                : 'Manage and track all your drops'}
            </p>
          </div>
          <Link to="/upload" className="btn-gold text-sm flex-shrink-0">
            <Upload className="w-4 h-4" />
            Upload New
          </Link>
        </div>

        {/* Alert banners */}
        {!loading && counts.review > 0 && (
          <button
            onClick={() => setActiveTab('review')}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/20 mb-4 text-left hover:bg-amber-500/12 transition-all group"
          >
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-300">
                {counts.review} drop{counts.review !== 1 ? 's' : ''} in review
              </p>
              <p className="text-xs text-arc-muted">Typically approved within 24 hours.</p>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-400/60 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
          </button>
        )}

        {showResubmitBanner && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-arc-success/5 border border-arc-success/25 mb-4">
            <CheckCircle className="w-4 h-4 text-arc-success flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-arc-success">Resubmitted for review</p>
              <p className="text-xs text-arc-muted">The team will take a look — typically within 24 hours.</p>
            </div>
            <button
              onClick={() => setShowResubmitBanner(false)}
              className="p-1.5 rounded-lg text-arc-muted hover:text-white hover:bg-white/8 transition-all flex-shrink-0"
              aria-label="Dismiss"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {!loading && counts.issues > 0 && (
          <button
            onClick={() => setActiveTab('issues')}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-arc-error/5 border border-arc-error/20 mb-4 text-left hover:bg-arc-error/8 transition-all group"
          >
            <AlertCircle className="w-4 h-4 text-arc-error flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-arc-error">
                {counts.issues} drop{counts.issues !== 1 ? 's' : ''} {counts.issues !== 1 ? 'have' : 'has'} feedback from the review team
              </p>
              <p className="text-xs text-arc-muted">Check the Issues tab — your work is preserved and ready to revise.</p>
            </div>
            <ChevronRight className="w-4 h-4 text-arc-error/60 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
          </button>
        )}

        {/* Tab bar */}
        <div className="border-b border-white/8 mb-6">
          <div className="flex gap-0 overflow-x-auto no-scrollbar -mb-px">
            {TABS.map(({ id, label }) => {
              const count = counts[id];
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-sans whitespace-nowrap border-b-2 transition-all ${
                    activeTab === id
                      ? 'border-gold text-gold'
                      : 'border-transparent text-arc-secondary hover:text-white'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                      activeTab === id
                        ? 'bg-gold text-bg-primary'
                        : 'bg-white/10 text-arc-muted'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter + sort row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          {/* Type pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-arc-muted flex-shrink-0" />
            {TYPE_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTypeFilter(id)}
                className={`px-3 py-1 rounded-full text-xs font-sans font-medium transition-all ${
                  typeFilter === id
                    ? 'bg-gold text-bg-primary shadow-gold-sm'
                    : 'border border-white/10 text-arc-secondary hover:border-gold/30 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sort select */}
          <div className="sm:ml-auto">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortBy)}
              className="input-dark w-auto text-xs py-1.5 px-3"
            >
              <option value="recent">Most Recent</option>
              <option value="unlocks">Most Unlocks</option>
              <option value="earning">Highest Earning</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        {!loading && filtered.length > 0 && (
          <p className="text-xs text-arc-muted mb-5">
            {filtered.length} drop{filtered.length !== 1 ? 's' : ''}
            {typeFilter !== 'all' ? ` · ${TYPE_LABELS[typeFilter]}` : ''}
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-arc-error/10 border border-arc-error/30 mb-6">
            <AlertCircle className="w-4 h-4 text-arc-error flex-shrink-0" />
            <p className="text-sm text-arc-error">{error}</p>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <MediaSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyPane tab={activeTab} type={typeFilter} hasAny={items.length > 0} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(item => <MediaCard key={item.id} item={item} />)}
          </div>
        )}

      </div>
    </div>
  );
}
