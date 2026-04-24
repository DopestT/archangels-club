import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
}

export default function EmptyState({ icon, title, description, action, secondaryAction, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mb-5 text-arc-muted">
          {icon}
        </div>
      )}
      <h3 className="font-serif text-lg text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-arc-secondary leading-relaxed max-w-sm mb-6">{description}</p>
      )}
      {!description && (action || secondaryAction) && <div className="mb-6" />}
      {action && (
        <button
          onClick={action.onClick}
          className="btn-gold text-sm"
        >
          {action.label}
        </button>
      )}
      {secondaryAction && (
        <button
          onClick={secondaryAction.onClick}
          className="mt-3 text-sm text-arc-muted hover:text-white transition-colors"
        >
          {secondaryAction.label}
        </button>
      )}
    </div>
  );
}
