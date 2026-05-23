import React, { useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { LANGUAGES } from '../../i18n';
import type { LangCode } from '../../i18n';

interface Props {
  /** Compact mode shows only the flag — used in mobile menu */
  compact?: boolean;
}

export default function LanguageSwitcher({ compact = false }: Props) {
  const { lang, setLang, isTransitioning } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function choose(code: LangCode) {
    setOpen(false);
    if (code !== lang) setLang(code);
  }

  const current = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={isTransitioning}
        aria-label="Change language"
        aria-expanded={open}
        className={`
          flex items-center gap-1.5 rounded-lg transition-all duration-200
          text-arc-secondary hover:text-white
          disabled:opacity-40 disabled:cursor-not-allowed
          ${compact
            ? 'px-3 py-2.5 w-full justify-between hover:bg-bg-hover'
            : 'p-2 hover:bg-bg-hover'
          }
        `}
      >
        {compact ? (
          <>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-sans">{current.native}</span>
            </div>
            <span className="text-xs text-arc-muted">{current.flag}</span>
          </>
        ) : (
          <>
            <Globe className="w-4 h-4" />
            <span className="text-xs font-mono text-arc-muted uppercase tracking-wider">
              {lang}
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          className={`
            absolute z-[200] py-1.5 rounded-xl overflow-hidden
            bg-bg-surface border border-gold-border/50 shadow-gold
            max-h-72 overflow-y-auto
            ${compact
              ? 'left-0 right-0 bottom-full mb-2'
              : 'right-0 top-full mt-2 w-44'
            }
          `}
          role="menu"
        >
          {LANGUAGES.map(({ code, native, flag }) => {
            const active = code === lang;
            return (
              <button
                key={code}
                role="menuitem"
                onClick={() => choose(code)}
                className={`
                  w-full flex items-center gap-3 px-3.5 py-2.5
                  text-sm font-sans transition-colors duration-150
                  ${active
                    ? 'text-gold bg-gold/5'
                    : 'text-arc-secondary hover:text-white hover:bg-bg-hover'
                  }
                `}
              >
                <span className="text-base leading-none flex-shrink-0" aria-hidden="true">
                  {flag}
                </span>
                <span className="flex-1 text-left">{native}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
