import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, Check, Zap, Crown, ShoppingBag, Info, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { timeAgo } from '../../lib/utils';
import { apiFetch as baseApiFetch } from '../../lib/api';

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

const TYPE_ICONS: Record<string, React.ReactNode> = {
  creator_first_sale:        <ShoppingBag className="w-3.5 h-3.5" />,
  creator_welcome:           <Crown className="w-3.5 h-3.5" />,
  creator_drop_live:         <Zap className="w-3.5 h-3.5" />,
  user_drop_alert:           <Zap className="w-3.5 h-3.5" />,
  user_purchase:             <ShoppingBag className="w-3.5 h-3.5" />,
  user_scarcity_alert:       <Zap className="w-3.5 h-3.5" />,
};

function getIcon(type: string) {
  return TYPE_ICONS[type] ?? <Info className="w-3.5 h-3.5" />;
}

function isCreatorType(type: string) { return type.startsWith('creator_'); }
function isDropType(type: string)    { return type.includes('drop') || type.includes('scarcity'); }

function apiFetch(path: string, opts?: RequestInit) {
  return baseApiFetch(`/api/notifications${path}`, opts);
}

export default function NotificationCenter() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try { const d = await apiFetch('/unread-count'); setUnread(d.count); }
    catch {}
  }, [isAuthenticated]);

  const fetchAll = useCallback(async () => {
    if (!isAuthenticated) return;
    try { const d = await apiFetch(''); setNotifications(d.notifications); setUnread(d.unread); }
    catch {}
  }, [isAuthenticated]);

  // Poll unread count every 30s
  useEffect(() => {
    fetchCount();
    const t = setInterval(fetchCount, 30_000);
    return () => clearInterval(t);
  }, [fetchCount]);

  // Load notifications when panel opens
  useEffect(() => { if (open) fetchAll(); }, [open, fetchAll]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function markRead(id: string) {
    try { await apiFetch(`/${id}/read`, { method: 'PATCH' }); }
    catch {}
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read' } : n));
    setUnread(prev => Math.max(0, prev - 1));
  }

  async function markAllRead() {
    try { await apiFetch('/read-all', { method: 'PATCH' }); }
    catch {}
    setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
    setUnread(0);
  }

  async function dismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try { await apiFetch(`/${id}`, { method: 'DELETE' }); }
    catch {}
    setNotifications(prev => prev.filter(n => n.id !== id));
    setUnread(prev => {
      const was = notifications.find(n => n.id === id);
      return was?.status === 'unread' ? Math.max(0, prev - 1) : prev;
    });
  }

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-arc-secondary hover:text-white hover:bg-bg-hover transition-all"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-bg-primary"
            style={{ background: '#D4AF37', padding: '0 4px' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-gold/20 shadow-gold z-50 flex flex-col"
          style={{ background: '#141419', maxHeight: '480px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
            <p className="font-serif text-sm text-white">Notifications</p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-arc-muted hover:text-gold transition-colors flex items-center gap-1">
                  <Check className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Bell className="w-8 h-8 text-arc-muted mb-3" />
                <p className="text-sm text-arc-secondary">You're all caught up</p>
                <p className="text-xs text-arc-muted mt-1">New notifications will appear here</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => n.status === 'unread' && markRead(n.id)}
                  className={`relative flex gap-3 px-4 py-3.5 border-b border-white/5 last:border-0 cursor-pointer hover:bg-bg-hover transition-colors ${n.status === 'unread' ? 'bg-gold/3' : ''}`}
                >
                  {/* Unread dot */}
                  {n.status === 'unread' && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gold" />
                  )}

                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isDropType(n.type) ? 'bg-arc-success/10 border-arc-success/25 text-arc-success' :
                    isCreatorType(n.type) ? 'bg-gold/10 border-gold/25 text-gold' :
                    'bg-white/5 border-white/10 text-arc-secondary'
                  }`}>
                    {getIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white leading-snug">{n.title}</p>
                    <p className="text-xs text-arc-muted leading-relaxed mt-0.5 line-clamp-2">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-arc-muted">{timeAgo(n.created_at)}</span>
                      {n.action_url && n.action_label && (
                        <Link
                          to={n.action_url}
                          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                          className="text-[10px] font-medium text-gold hover:text-gold-hover transition-colors flex items-center gap-0.5"
                        >
                          {n.action_label} <ArrowRight className="w-2.5 h-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => dismiss(n.id, e)}
                    className="flex-shrink-0 p-1 text-arc-muted hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-white/8 flex-shrink-0">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-arc-muted hover:text-gold transition-colors flex items-center justify-center gap-1"
            >
              View all notifications <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
