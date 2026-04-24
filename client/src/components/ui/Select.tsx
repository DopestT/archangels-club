import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption { value: string; label: string; }

interface SelectProps {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function Select({ label, error, hint, options, value, onChange, placeholder, className = '' }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs text-arc-secondary font-medium">{label}</label>}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full appearance-none bg-bg-hover border ${error ? 'border-arc-error/60' : 'border-white/10 focus:border-gold/60'} rounded-xl px-4 py-3 pr-10 text-sm text-white outline-none transition-all duration-200 cursor-pointer ${className}`}
          style={{ background: '#1E1E26' }}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} style={{ background: '#1E1E26' }}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-arc-muted pointer-events-none" />
      </div>
      {error && <p className="text-xs text-arc-error">{error}</p>}
      {hint && !error && <p className="text-xs text-arc-muted">{hint}</p>}
    </div>
  );
}
