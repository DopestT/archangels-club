import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CreatorPromptCardProps {
  icon: React.ReactNode;
  title: string;
  reason: string;
  actionLabel: string;
  actionTo?: string;
  actionOnClick?: () => void;
  variant?: 'gold' | 'default';
  className?: string;
}

export default function CreatorPromptCard({
  icon, title, reason, actionLabel, actionTo, actionOnClick, variant = 'default', className = '',
}: CreatorPromptCardProps) {
  const isGold = variant === 'gold';

  const inner = (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 group ${isGold ? 'border-gold/25 bg-gold/6 hover:bg-gold/10 hover:border-gold/40' : 'border-white/8 bg-bg-surface hover:border-white/15 hover:bg-bg-hover'}`}>
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${isGold ? 'bg-gold/10 border-gold/20 text-gold' : 'bg-white/5 border-white/10 text-arc-secondary group-hover:text-white'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isGold ? 'text-gold' : 'text-white'}`}>{title}</p>
        <p className="text-xs text-arc-muted leading-relaxed mt-0.5">{reason}</p>
      </div>
      <div className={`flex items-center gap-1 text-xs font-medium flex-shrink-0 ${isGold ? 'text-gold' : 'text-arc-secondary group-hover:text-white'}`}>
        {actionLabel}
        <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </div>
  );

  if (actionTo) return <Link to={actionTo} className={className}>{inner}</Link>;
  return <button onClick={actionOnClick} className={`w-full text-left ${className}`}>{inner}</button>;
}
