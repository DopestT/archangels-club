import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Check, Trash2, Zap, Crown, ShoppingBag, Info, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationSkeleton } from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';
import Tabs from '../components/ui/Tabs';
import { timeAgo } from '../lib/utils';
import { apiFetch as baseApiFetch } from '../lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  action_label: string | null;
  action_url: string | null;
  status: 'unread' | 'read';
  created_at: string;
}

type FilterTab = 'all' | 'creator' | 'user' | 'unread';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  creator_first_sale: <ShoppingBag className="w-4 h-4" />,
  creator_welcome:    <Crown className="w-4 h-4" />,
  creator_drop_live:  <Zap className="w-4 h-4" />,
  user_drop_alert:    <Zap className="w-4 h-4" />,
  user_purchase:      <ShoppingBag className="w-4 h-4" />,
};

function icon(type: string) { return TYPE_ICONS[type] ?? <Info className="w-4 h-4" />; }
function isCreatorType(t: string) { return t.startsWith('creator_'); }
function isDropType(t: string)    { return t.includes('drop') || t.includes('scarcity'); }

function apiFetch(path: string, opts?: RequestInit) {
  return baseApiFetch(`/api/notifications${path}`, opts);
}

export default function NotificationsPage() {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');

  const fetch = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    setLoading(true);
    try { const d = await apiFetch(''); setNotifications(d.notifications ?? []); }
    catch { setNotifications([]); }
    finally { setLoading(false); }
  }, [isAuthenticated]);

  useEffect(() => { fetch(); }, [fetch]);

  async function markRead(id: string) {
    await apiFetch(`/${id}/read`, { method: 'PATCH' });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read' } : n));
  }

  async function markAllRead() {
    await apiFetch('/read-all', { method: 'PATCH' });
    setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
  }

  async function dismiss(id: string) {
    await apiFetch(`/${id}`, { method: 'DELETE' });
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return n.status === 'unread';
    if (filter === 'creator') return isCreatorType(n.type);
    if (filter === 'user') return !isCreatorType(n.type);
    return true;
  });

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  return (
    <div className="min-h-screen bg-bg-primary py-10">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="section-eyebrow mb-1">Inbox</p>
            <h1 className="font-serif text-3xl text-white">Notifications</h1>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1.5 text-sm text-arc-muted hover:text-gold transition-colors">
              <Check className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <Tabs
          tabs={[
            { id: 'all' as FilterTab,     label: 'All',     badge: notifications.length },
            { id: 'unread' as FilterTab,  label: 'Unread',  badge: unreadCount },
            { id: 'creator' as FilterTab, label: 'Creator' },
            { id: 'user' as FilterTab,    label: 'Member' },
          ]}
          active={filter}
          onChange={setFilter}
          className="mb-6"
        />

        {/* Notifications list */}
        {loading ? (
          <div className="space-y-0 card-surface rounded-xl overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => <NotificationSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Bell className="w-7 h-7" />}
            title="No notifications"
            description={filter === 'unread' ? "You're all caught up." : "Notifications will appear here as activity happens."}
          />
        ) : (
          <div className="card-surface rounded-xl overflow-hidden">
            {filtered.map((n, i) => (
              <div
                key={n.id}
                className={`relative flex gap-4 px-5 py-4 border-b border-white/5 last:border-0 transition-colors ${n.status === 'unread' ? 'bg-gold/3 hover:bg-gold/5' : 'hover:bg-bg-hover'}`}
              >
                {/* Unread indicator */}
                {n.status === 'unread' && (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gold" />
                )}

                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                  isDropType(n.type)    ? 'bg-arc-success/10 border-arc-success/25 text-arc-success' :
                  isCreatorType(n.type) ? 'bg-gold/10 border-gold/25 text-gold' :
                  'bg-white/5 border-white/10 text-arc-secondary'
                }`}>
                  {icon(n.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium mb-0.5 ${n.status === 'unread' ? 'text-white' : 'text-arc-secondary'}`}>{n.title}</p>
                  <p className="text-xs text-arc-muted leading-relaxed">{n.message}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-arc-muted">{timeAgo(n.created_at)}</span>
                    {n.action_url && n.action_label && (
                      <Link to={n.action_url} className="text-xs font-medium text-gold hover:text-gold-hover transition-colors">
                        {n.action_label} →
                      </Link>
                    )}
                    {n.status === 'unread' && (
                      <button onClick={() => markRead(n.id)} className="text-xs text-arc-muted hover:text-white transition-colors">
                        Mark read
                      </button>
                    )}
                  </div>
                </div>

                {/* Dismiss */}
                <button onClick={() => dismiss(n.id)} className="flex-shrink-0 p-1.5 text-arc-muted hover:text-arc-error hover:bg-arc-error/10 rounded-lg transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
