import React, { useRef } from 'react';
import { motion, useMotionValue, useTransform, useSpring, useReducedMotion } from 'framer-motion';

interface HoverCardProps {
  children: React.ReactNode;
  className?: string;
  goldGlow?: boolean;    // subtle gold border luminance on hover
  intensity?: 'low' | 'medium' | 'high';
}

export default function HoverCard({
  children,
  className = '',
  goldGlow = false,
  intensity = 'medium',
}: HoverCardProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const tiltX = useTransform(y, [-0.5, 0.5], intensity === 'high' ? [4, -4] : intensity === 'medium' ? [2.5, -2.5] : [1.5, -1.5]);
  const tiltY = useTransform(x, [-0.5, 0.5], intensity === 'high' ? [-4, 4] : intensity === 'medium' ? [-2.5, 2.5] : [-1.5, 1.5]);

  const springX = useSpring(tiltX, { stiffness: 200, damping: 30 });
  const springY = useSpring(tiltY, { stiffness: 200, damping: 30 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={`${className} transition-shadow duration-300`}
      style={{ rotateX: springX, rotateY: springY, transformStyle: 'preserve-3d', transformPerspective: 800 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{
        y: -3,
        boxShadow: goldGlow
          ? '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,175,55,0.18)'
          : '0 8px 32px rgba(0,0,0,0.45)',
        transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
      }}
    >
      {children}
    </motion.div>
  );
}
