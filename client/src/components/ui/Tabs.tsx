import React from 'react';

interface Tab<T extends string> { id: T; label: string; badge?: number; }

interface TabsProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (tab: T) => void;
  variant?: 'underline' | 'pill';
  className?: string;
}

export default function Tabs<T extends string>({ tabs, active, onChange, variant = 'underline', className = '' }: TabsProps<T>) {
  if (variant === 'pill') {
    return (
      <div className={`flex gap-1 p-1 rounded-xl bg-bg-hover border border-white/8 w-fit ${className}`}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              active === t.id
                ? 'bg-gold text-bg-primary shadow-gold-sm'
                : 'text-arc-secondary hover:text-white'
            }`}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${active === t.id ? 'bg-bg-primary/20 text-bg-primary' : 'bg-white/10 text-arc-muted'}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex border-b border-white/8 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-all duration-200 ${
            active === t.id
              ? 'border-gold text-gold'
              : 'border-transparent text-arc-secondary hover:text-white hover:border-white/20'
          }`}
        >
          {t.label}
          {t.badge !== undefined && t.badge > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${active === t.id ? 'bg-gold/15 text-gold border border-gold/25' : 'bg-white/8 text-arc-muted'}`}>
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
