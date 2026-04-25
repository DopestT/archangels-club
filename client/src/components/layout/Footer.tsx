import React from 'react';
import { Link } from 'react-router-dom';
import { Crown, Shield, Lock } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-gold-border/40 bg-bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded bg-gold-gradient flex items-center justify-center shadow-gold-sm">
                <Crown className="w-4 h-4 text-bg-primary" />
              </div>
              <span className="font-serif text-lg text-white">Archangels</span>
            </Link>
            <p className="text-sm text-arc-secondary leading-relaxed max-w-xs">
              Private access. Exclusive content. A members-only platform built for the discerning few.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-arc-muted">
              <Lock className="w-3.5 h-3.5 text-gold" />
              <span>18+ Platform · Age Verification Required</span>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="section-eyebrow mb-4">Platform</h4>
            <ul className="space-y-3">
              {[
                { to: '/explore', label: 'Explore Creators' },
                { to: '/signup', label: 'Request Access' },
                { to: '/login', label: 'Member Login' },
                { to: '/apply-creator', label: 'Creator Application' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-arc-secondary hover:text-gold transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="section-eyebrow mb-4">Legal</h4>
            <ul className="space-y-3">
              {[
                { to: '/privacy', label: 'Privacy Policy' },
                { to: '/terms', label: 'Terms of Service' },
                { to: '/compliance', label: 'Compliance' },
                { to: '/dmca', label: 'DMCA' },
                { to: '/age-verification', label: 'Age Verification' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-arc-secondary hover:text-gold transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="section-eyebrow mb-4">Support</h4>
            <ul className="space-y-3">
              {[
                { to: '/contact', label: 'Contact Us' },
                { to: '/report', label: 'Report Content' },
                { to: '/help', label: 'Help Center' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-arc-secondary hover:text-gold transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6 p-3 rounded-lg bg-bg-surface border border-gold-border/30">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-3.5 h-3.5 text-gold" />
                <span className="text-xs font-medium text-gold">Compliance</span>
              </div>
              <p className="text-xs text-arc-muted leading-relaxed">
                All creators are age-verified. All content is moderated. Platform compliant with applicable regulations.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-arc-muted">
            © {new Date().getFullYear()} Archangels Club. All rights reserved. For adults only (18+).
          </p>
          <p className="text-xs text-arc-muted">
            Platform fee: 20% · Payments processed securely
          </p>
        </div>
      </div>
    </footer>
  );
}
