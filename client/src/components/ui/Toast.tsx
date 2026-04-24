import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (opts: Omit<ToastItem, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <Check className="w-4 h-4" />,
  error:   <X className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  info:    <Info className="w-4 h-4" />,
};

const STYLES: Record<ToastVariant, string> = {
  success: 'border-arc-success/25 bg-arc-success/10 text-arc-success',
  error:   'border-arc-error/25 bg-arc-error/10 text-arc-error',
  warning: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
  info:    'border-blue-500/25 bg-blue-500/10 text-blue-400',
};

function ToastItem({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onRemove(item.id), item.duration ?? 4000);
    return () => clearTimeout(t);
  }, [item.id, item.duration, onRemove]);

  return (
    <div
      className={`flex items-start gap-3 w-80 rounded-xl border p-4 shadow-gold backdrop-blur-sm animate-slide-up ${STYLES[item.variant]}`}
      style={{ background: '#141419ee' }}
    >
      <span className="flex-shrink-0 mt-0.5">{ICONS[item.variant]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{item.title}</p>
        {item.message && <p className="text-xs text-arc-muted mt-0.5 leading-relaxed">{item.message}</p>}
      </div>
      <button onClick={() => onRemove(item.id)} className="flex-shrink-0 text-arc-muted hover:text-white transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((opts: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { ...opts, id }]);
  }, []);

  const value: ToastContextValue = {
    toast,
    success: (title, message) => toast({ variant: 'success', title, message }),
    error:   (title, message) => toast({ variant: 'error',   title, message }),
    warning: (title, message) => toast({ variant: 'warning', title, message }),
    info:    (title, message) => toast({ variant: 'info',    title, message }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem item={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
