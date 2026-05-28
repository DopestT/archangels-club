import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Crown, Users, DollarSign, Flag, LayoutDashboard,
  UserCheck, Image, Shield, Bug, Activity,
} from 'lucide-react';

const NAV = [
  { to: '/admin',                   label: 'Overview',          icon: Users },
  { to: '/admin/pulse',             label: 'Pulse',             icon: Activity },
  { to: '/admin/access-requests',   label: 'Access Requests',   icon: UserCheck },
  { to: '/admin/creator-approvals', label: 'Creator Approvals', icon: Crown },
  { to: '/admin/content-approvals', label: 'Content Approvals', icon: Image },
  { to: '/admin/flagged',           label: 'Reports',           icon: Flag },
  { to: '/admin/transactions',      label: 'Transactions',      icon: DollarSign },
  { to: '/admin/verifications',     label: 'Verifications',     icon: Shield },
  { to: '/admin/control-center',    label: 'Command Center',    icon: LayoutDashboard },
  { to: '/admin/bug-control',       label: 'Bug Control',       icon: Bug },
];

export default function AdminSidebar({ badges = {} }: { badges?: Record<string, number> }) {
  const { pathname } = useLocation();

  const totalPending = Object.values(badges).reduce((s, v) => s + v, 0);
  const hasCritical  = (badges['/admin/flagged'] ?? 0) > 0;
  const hasElevated  = totalPending > 0 && !hasCritical;

  const statusDot  = hasCritical ? '#EF4444' : hasElevated ? '#FBBF24' : '#22C55E';
  const statusText = hasCritical ? 'Attention Required' : hasElevated ? 'Items Pending' : 'System Operational';

  return (
    <aside
      className="flex-shrink-0 min-h-screen flex flex-col border-r border-white/5"
      style={{ width: 220, backgroundColor: 'var(--color-bg-surface, #0f0f11)' }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-white/5">
        <Link to="/" className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #d4af37 0%, #a8832a 100%)', boxShadow: '0 0 12px rgba(212,175,55,0.25)' }}
          >
            <Crown className="w-3.5 h-3.5 text-black" />
          </div>
          <span className="font-serif text-white text-sm tracking-wide">Archangels</span>
        </Link>
        <p className="text-[9px] font-bold tracking-[0.2em] text-gold/70 uppercase mt-3 ml-0.5">Operations</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          const badge = badges[to] ?? 0;
          return (
            <Link
              key={label}
              to={to}
              className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 ${
                active
                  ? 'text-gold bg-gold/8'
                  : 'text-arc-secondary hover:text-white hover:bg-white/5'
              }`}
              style={active ? { boxShadow: 'inset 0 0 12px rgba(212,175,55,0.06)' } : undefined}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r"
                  style={{ background: 'linear-gradient(180deg, #d4af37 0%, #a8832a 100%)' }}
                />
              )}
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className="text-[10px] min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-bold">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* System status — dynamic based on queue urgency */}
      <div className="px-5 py-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              backgroundColor: statusDot,
              animation: hasCritical
                ? 'pulseSignalDot 1.8s ease-in-out infinite'
                : hasElevated
                ? 'pulseSignalDot 2.4s ease-in-out infinite'
                : undefined,
            }}
          />
          <span className="text-[11px] text-arc-muted">{statusText}</span>
          {totalPending > 0 && (
            <span
              className="ml-auto text-[10px] font-bold tabular-nums"
              style={{ color: hasCritical ? '#EF4444' : '#FBBF24' }}
            >
              {totalPending}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
