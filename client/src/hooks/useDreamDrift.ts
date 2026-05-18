import { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';

/**
 * Dream Drift — soft fade + gentle lift transition.
 * Usage:
 *   const { style, drift } = useDreamDrift();
 *   drift(() => setStep(next));   // triggers exit → swap → enter
 *   <div style={style}>...</div>
 */
export function useDreamDrift(duration = 180) {
  const [visible, setVisible] = useState(true);

  const drift = useCallback(
    (fn: () => void) => {
      setVisible(false);
      setTimeout(() => {
        fn();
        setVisible(true);
      }, duration);
    },
    [duration],
  );

  const style: CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(8px)',
    transition: `opacity ${duration + 20}ms ease, transform ${duration + 20}ms ease`,
  };

  return { visible, drift, style };
}
