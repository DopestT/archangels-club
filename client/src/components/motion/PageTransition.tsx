import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

/**
 * Global per-route entrance. Keyed on pathname so every navigation re-fires
 * the fade. Opacity-only by design: a transform on this wrapper would become a
 * containing block and break `position: fixed` descendants (live gift banner,
 * floating activity widget). The slide/lift feel comes from each page's own
 * <Reveal> components layered on top of this cross-fade.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const reduced = useReducedMotion();

  if (reduced) return <>{children}</>;

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
