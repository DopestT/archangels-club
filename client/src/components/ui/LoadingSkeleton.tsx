import React from 'react';

interface SkeletonProps { className?: string; }

function Bone({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`rounded-lg bg-white/6 relative overflow-hidden ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)' }}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)' }}
      />
    </div>
  );
}

export function ContentCardSkeleton() {
  return (
    <div className="card-surface overflow-hidden">
      <Bone className="h-52 w-full rounded-none" />
      <div className="p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <Bone className="w-6 h-6 rounded-full" />
          <Bone className="h-3 w-24" />
        </div>
        <Bone className="h-4 w-4/5" />
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export function CreatorCardSkeleton() {
  return (
    <div className="card-surface overflow-hidden">
      <Bone className="h-28 w-full rounded-none" />
      <div className="px-5 pb-5">
        <div className="relative -mt-7 mb-3">
          <Bone className="w-14 h-14 rounded-full" />
        </div>
        <Bone className="h-4 w-32 mb-1.5" />
        <Bone className="h-3 w-20 mb-3" />
        <Bone className="h-3 w-full mb-1.5" />
        <Bone className="h-3 w-3/4" />
      </div>
    </div>
  );
}

export function NotificationSkeleton() {
  return (
    <div className="flex gap-3 p-4">
      <Bone className="w-9 h-9 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Bone className="h-3.5 w-3/4" />
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card-surface p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Bone className="h-3 w-24" />
        <Bone className="w-8 h-8 rounded-lg" />
      </div>
      <Bone className="h-7 w-28" />
      <Bone className="h-3 w-20" />
    </div>
  );
}

export default Bone;
