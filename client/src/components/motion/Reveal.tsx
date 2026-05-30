import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { fadeUp, staggerContainer } from '../../lib/motionTokens';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: boolean; // wraps children in stagger container
}

export default function Reveal({ children, className, delay = 0, stagger = false }: RevealProps) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  if (stagger) {
    return (
      <motion.div
        className={className}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        variants={staggerContainer}
        transition={delay ? { delayChildren: delay } : undefined}
      >
        {React.Children.map(children, (child, i) => (
          <motion.div key={i} variants={fadeUp}>
            {child}
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={fadeUp}
      transition={delay ? { delay } : undefined}
    >
      {children}
    </motion.div>
  );
}
