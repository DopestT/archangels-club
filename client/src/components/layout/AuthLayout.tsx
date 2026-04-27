import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../brand/Logo';

interface AuthLayoutProps {
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}

export default function AuthLayout({ children, eyebrow, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-bg-primary"
      style={{ background: 'radial-gradient(ellipse at 50% -10%, rgba(212,175,55,0.08) 0%, transparent 55%)' }}>

      {/* Logo — full logo (icon + wordmark) */}
      <Link to="/" className="mb-10 opacity-90 hover:opacity-100 transition-opacity">
        <Logo variant="primary" size="md" />
      </Link>

      {/* Header */}
      {(eyebrow || title) && (
        <div className="text-center mb-8">
          {eyebrow && <p className="section-eyebrow mb-2">{eyebrow}</p>}
          {title && <h1 className="font-serif text-3xl text-white mb-2">{title}</h1>}
          {subtitle && <p className="text-arc-secondary text-sm">{subtitle}</p>}
        </div>
      )}

      {/* Card */}
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
