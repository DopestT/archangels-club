import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface ShimmerSkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full' | 'xl';
}

export function ShimmerSkeleton({ className = '', rounded = 'md' }: ShimmerSkeletonProps) {
  const reduced = useReducedMotion();
  const roundedMap = { sm: 'rounded', md: 'rounded-lg', lg: 'rounded-xl', xl: 'rounded-2xl', full: 'rounded-full' };

  if (reduced) {
    return <div className={`bg-white/5 ${roundedMap[rounded]} ${className}`} />;
  }

  return (
    <div className={`relative overflow-hidden bg-white/5 ${roundedMap[rounded]} ${className}`}>
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(105deg, transparent 40%, rgba(212,175,55,0.06) 50%, transparent 60%)',
          backgroundSize: '200% 100%',
        }}
        animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'linear', repeatDelay: 0.4 }}
      />
    </div>
  );
}

// Pre-built skeleton layouts
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-white/6 bg-white/3 p-5 space-y-3 ${className}`}>
      <ShimmerSkeleton className="h-40 w-full" rounded="lg" />
      <ShimmerSkeleton className="h-3.5 w-2/3" />
      <ShimmerSkeleton className="h-2.5 w-1/2" />
      <div className="flex items-center gap-2 pt-1">
        <ShimmerSkeleton className="h-6 w-6" rounded="full" />
        <ShimmerSkeleton className="h-2.5 w-24" />
      </div>
    </div>
  );
}

export function StatSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-white/6 bg-white/3 p-5 ${className}`}>
      <ShimmerSkeleton className="h-2.5 w-20 mb-3" />
      <ShimmerSkeleton className="h-8 w-28 mb-2" />
      <ShimmerSkeleton className="h-2 w-16" />
    </div>
  );
}
