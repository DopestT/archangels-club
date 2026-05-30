import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface GoldPulseButtonProps {
  children: React.ReactNode;
  className?: string;
  pulse?: boolean; // continuous pulse animation
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export default function GoldPulseButton({
  children,
  className = '',
  pulse = false,
  onClick,
  disabled,
  type = 'button',
}: GoldPulseButtonProps) {
  const reduced = useReducedMotion();

  return (
    <div className="relative inline-flex">
      {pulse && !reduced && !disabled && (
        <motion.span
          className="absolute inset-0 rounded-xl pointer-events-none"
          animate={{
            boxShadow: [
              '0 0 0 0px rgba(212,175,55,0)',
              '0 0 0 6px rgba(212,175,55,0.12)',
              '0 0 0 0px rgba(212,175,55,0)',
            ],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <motion.button
        type={type}
        className={className}
        onClick={onClick}
        disabled={disabled}
        whileHover={reduced ? {} : { scale: 1.015, transition: { duration: 0.2 } }}
        whileTap={reduced ? {} : { scale: 0.975, transition: { duration: 0.1 } }}
      >
        {children}
      </motion.button>
    </div>
  );
}
