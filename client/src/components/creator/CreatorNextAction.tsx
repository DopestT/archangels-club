import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { NextAction } from '../../hooks/useCreatorProgress';

interface CreatorNextActionProps {
  action: NextAction;
  className?: string;
}

export default function CreatorNextAction({ action, className = '' }: CreatorNextActionProps) {
  return (
    <div
      className={`rounded-xl border border-white/8 bg-bg-surface px-6 py-5 mb-8 ${className}`}
      style={{ borderLeft: '2px solid rgba(212,175,55,0.5)' }}
    >
      <p className="section-eyebrow mb-3">Studio Brief</p>
      <h2 className="font-serif text-xl text-white mb-1.5 leading-snug">{action.headline}</h2>
      <p className="text-sm text-arc-secondary leading-relaxed mb-4">{action.subline}</p>
      <Link
        to={action.ctaTo}
        className="inline-flex items-center gap-2 text-sm font-medium text-gold hover:gap-3 transition-all"
      >
        {action.ctaLabel}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
