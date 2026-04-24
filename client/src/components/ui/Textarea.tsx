import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  maxLength?: number;
  showCount?: boolean;
}

export default function Textarea({ label, error, hint, maxLength, showCount, className = '', id, value, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const length = typeof value === 'string' ? value.length : 0;
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={inputId} className="text-xs text-arc-secondary font-medium">{label}</label>
          {showCount && maxLength && (
            <span className="text-xs text-arc-muted">{length}/{maxLength}</span>
          )}
        </div>
      )}
      <textarea
        id={inputId}
        value={value}
        maxLength={maxLength}
        className={`w-full bg-bg-hover border ${error ? 'border-arc-error/60 focus:border-arc-error' : 'border-white/10 focus:border-gold/60'} rounded-xl px-4 py-3 text-sm text-white placeholder-arc-muted outline-none transition-all duration-200 resize-y min-h-24 ${className}`}
        style={{ background: '#1E1E26' }}
        {...props}
      />
      {error && <p className="text-xs text-arc-error">{error}</p>}
      {hint && !error && <p className="text-xs text-arc-muted">{hint}</p>}
    </div>
  );
}
