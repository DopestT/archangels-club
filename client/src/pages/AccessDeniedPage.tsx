import React from 'react';
import { Link } from 'react-router-dom';
import { Ban, AlertTriangle, XCircle, LogOut, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserStatus } from '../types';

const STATUS_CONFIG: Record<Exclude<UserStatus, 'pending' | 'approved'>, {
  icon: React.ReactNode;
  color: string;
  title: string;
  message: string;
}> = {
  rejected: {
    icon: <XCircle className="w-9 h-9 text-arc-error" />,
    color: 'bg-arc-error/10 border-arc-error/30',
    title: 'Access Request Rejected',
    message: 'Your access request was not approved at this time. This may be due to incomplete information or platform eligibility requirements. You may reapply after 30 days.',
  },
  suspended: {
    icon: <AlertTriangle className="w-9 h-9 text-amber-400" />,
    color: 'bg-amber-500/10 border-amber-500/30',
    title: 'Account Suspended',
    message: 'Your account has been temporarily suspended due to a policy violation. Please contact support to understand the reason and appeal the decision.',
  },
  banned: {
    icon: <Ban className="w-9 h-9 text-arc-error" />,
    color: 'bg-arc-error/10 border-arc-error/30',
    title: 'Account Permanently Banned',
    message: 'Your account has been permanently banned due to a serious violation of our Terms of Service. This decision is final.',
  },
};

export default function AccessDeniedPage() {
  const { user, logout, userStatus } = useAuth();
  const status = (userStatus as Exclude<UserStatus, 'pending' | 'approved'>) ?? 'rejected';
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.rejected;

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className={`w-20 h-20 rounded-full border flex items-center justify-center mx-auto mb-8 ${config.color}`}>
          {config.icon}
        </div>

        <h1 className="font-serif text-3xl text-white mb-4">{config.title}</h1>

        <p className="text-arc-secondary leading-relaxed mb-8">{config.message}</p>

        <div className="flex flex-col gap-3">
          {status !== 'banned' && (
            <a href="mailto:access@archangelsclub.com" className="btn-outline w-full">
              <Mail className="w-4 h-4" />
              Contact Support
            </a>
          )}
          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 text-sm text-arc-muted hover:text-white transition-colors py-2"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>

        <div className="mt-10 pt-6 border-t border-white/5">
          <Link to="/" className="text-xs text-arc-muted hover:text-gold transition-colors">
            ← Return to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
