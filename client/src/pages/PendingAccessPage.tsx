import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Mail, Shield, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PendingAccessPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-8">
          <Clock className="w-9 h-9 text-amber-400" />
        </div>

        <span className="section-eyebrow mb-4 block">Under Review</span>

        <h1 className="font-serif text-3xl text-white mb-4 leading-snug">
          Your Request<br />Is Being Reviewed
        </h1>

        <p className="text-arc-secondary leading-relaxed mb-6">
          Access to Archangels Club is granted by our team after a manual review.
          This process typically takes <strong className="text-white">24–48 hours</strong>.
        </p>

        <div className="card-surface p-6 rounded-xl text-left mb-6 space-y-4">
          <div className="flex items-start gap-3">
            <Mail className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-white font-medium mb-0.5">Check your email</p>
              <p className="text-xs text-arc-secondary">
                We'll notify <span className="text-gold">{user?.email}</span> as soon as your account is approved or if we need more information.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-white font-medium mb-0.5">Why we review</p>
              <p className="text-xs text-arc-secondary">
                Archangels Club is a selective, private platform. Every member is reviewed to maintain the quality and safety of the community.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <a href="mailto:access@archangelsclub.com" className="btn-outline w-full">
            <Mail className="w-4 h-4" />
            Contact Support
          </a>
          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 text-sm text-arc-muted hover:text-white transition-colors py-2"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>

        <p className="mt-8 text-xs text-arc-muted">
          Applied with the wrong email?{' '}
          <Link to="/signup" className="text-gold hover:underline">Start a new request</Link>
        </p>
      </div>
    </div>
  );
}
