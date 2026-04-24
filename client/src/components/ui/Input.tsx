import React from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export default function Input({ label, error, hint, prefix, suffix, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs text-arc-secondary font-medium">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-arc-muted text-sm pointer-events-none">{prefix}</span>
        )}
        <input
          id={inputId}
          className={`w-full bg-bg-hover border ${error ? 'border-arc-error/60 focus:border-arc-error' : 'border-white/10 focus:border-gold/60'} rounded-xl px-4 py-3 text-sm text-white placeholder-arc-muted outline-none transition-all duration-200 ${prefix ? 'pl-9' : ''} ${suffix ? 'pr-9' : ''} ${className}`}
          style={{ background: '#1E1E26' }}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-arc-muted text-sm pointer-events-none">{suffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-arc-error">{error}</p>}
      {hint && !error && <p className="text-xs text-arc-muted">{hint}</p>}
    </div>
  );
}
