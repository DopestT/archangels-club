import { useCallback, useRef, useState } from 'react';

interface ConfirmState {
  label: string;
  key: number;
}

export function useActionPress(holdMs = 1400) {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const showConfirm = useCallback((label: string) => {
    clearTimeout(timerRef.current);
    setConfirm({ label, key: Date.now() });
    timerRef.current = setTimeout(() => setConfirm(null), holdMs);
  }, [holdMs]);

  return { confirm, showConfirm };
}
