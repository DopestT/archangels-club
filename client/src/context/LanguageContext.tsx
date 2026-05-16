import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { en, es, fr, de, ja, pt } from '../i18n';
import type { LangCode, TranslationMap } from '../i18n';

// ── Translation dictionaries ─────────────────────────────────────────────────

const DICTS: Record<LangCode, TranslationMap> = { en, es, fr, de, ja, pt };

// ── Persisted language preference ────────────────────────────────────────────

const STORAGE_KEY = 'arc_lang';
const DEFAULT_LANG: LangCode = 'en';
const VALID: Set<string> = new Set(['en', 'es', 'fr', 'de', 'ja', 'pt']);

function readStoredLang(): LangCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID.has(stored)) return stored as LangCode;
  } catch {}
  // Respect browser language preference
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  if (VALID.has(browserLang)) return browserLang as LangCode;
  return DEFAULT_LANG;
}

// ── Dream Drift sequence timings (ms) ────────────────────────────────────────

const EXIT_DURATION  = 150;
const ENTER_DURATION = 380;
const GLOW_OFFSET    = 80;  // glow appears this many ms after exit starts

// ── Context type ─────────────────────────────────────────────────────────────

interface LanguageContextValue {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  t: (key: keyof TranslationMap) => string;
  isTransitioning: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState]     = useState<LangCode>(readStoredLang);
  const [isTransitioning, setTransitioning] = useState(false);
  const wrapperRef    = useRef<HTMLDivElement>(null);
  const glowRef       = useRef<HTMLDivElement>(null);
  const pendingLang   = useRef<LangCode | null>(null);
  const rafRef        = useRef<number>(0);
  const timerRefs     = useRef<ReturnType<typeof setTimeout>[]>([]);

  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  function clearTimers() {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
    cancelAnimationFrame(rafRef.current);
  }

  const runDreamDrift = useCallback((nextLang: LangCode) => {
    const wrapper = wrapperRef.current;
    const glow    = glowRef.current;
    if (!wrapper) {
      setLangState(nextLang);
      return;
    }

    setTransitioning(true);
    clearTimers();

    // ── 1. Exit phase ────────────────────────────────────────────────────────
    wrapper.classList.remove('dream-drift-enter', 'dream-drift-settled');
    wrapper.classList.add('dream-drift-exit');

    // ── 2. Glow pulse (offset from exit start) ───────────────────────────────
    if (glow) {
      timerRefs.current.push(
        setTimeout(() => {
          glow.classList.add('dream-drift-glow-active');
        }, GLOW_OFFSET)
      );
    }

    // ── 3. Swap language at peak of exit ────────────────────────────────────
    timerRefs.current.push(
      setTimeout(() => {
        setLangState(nextLang);
        localStorage.setItem(STORAGE_KEY, nextLang);

        // Force a layout recalc so the DOM reflects new text before enter
        rafRef.current = requestAnimationFrame(() => {
          // ── 4. Enter phase ─────────────────────────────────────────────────
          if (wrapper) {
            wrapper.classList.remove('dream-drift-exit');
            wrapper.classList.add('dream-drift-enter');
          }

          // Dismiss glow as enter resolves
          if (glow) {
            setTimeout(() => glow.classList.remove('dream-drift-glow-active'), 80);
          }

          // ── 5. Cleanup ──────────────────────────────────────────────────────
          timerRefs.current.push(
            setTimeout(() => {
              if (wrapper) {
                wrapper.classList.remove('dream-drift-enter');
                wrapper.classList.add('dream-drift-settled');
              }
              setTransitioning(false);
              pendingLang.current = null;
            }, ENTER_DURATION + 20)
          );
        });
      }, EXIT_DURATION)
    );
  }, []);

  const setLang = useCallback((nextLang: LangCode) => {
    if (nextLang === lang && !isTransitioning) return;

    if (prefersReducedMotion.current) {
      // Reduced motion: skip glow, use short crossfade via CSS
      const wrapper = wrapperRef.current;
      clearTimers();
      setTransitioning(true);
      if (wrapper) {
        wrapper.classList.remove('dream-drift-enter', 'dream-drift-settled');
        wrapper.classList.add('dream-drift-exit');
      }
      timerRefs.current.push(
        setTimeout(() => {
          setLangState(nextLang);
          localStorage.setItem(STORAGE_KEY, nextLang);
          rafRef.current = requestAnimationFrame(() => {
            if (wrapper) {
              wrapper.classList.remove('dream-drift-exit');
              wrapper.classList.add('dream-drift-enter');
            }
            timerRefs.current.push(
              setTimeout(() => {
                if (wrapper) {
                  wrapper.classList.remove('dream-drift-enter');
                  wrapper.classList.add('dream-drift-settled');
                }
                setTransitioning(false);
              }, 200)
            );
          });
        }, 120)
      );
      return;
    }

    pendingLang.current = nextLang;
    runDreamDrift(nextLang);
  }, [lang, isTransitioning, runDreamDrift]);

  useEffect(() => () => clearTimers(), []);

  const t = useCallback((key: keyof TranslationMap): string => {
    return DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isTransitioning }}>
      {/* Ambient glow overlay — appears at transition crossover */}
      <div ref={glowRef} id="dream-drift-glow" aria-hidden="true" />

      {/* Main content wrapper — receives animation classes */}
      <div ref={wrapperRef} style={{ isolation: 'isolate' }}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

export function useT() {
  return useLanguage().t;
}
