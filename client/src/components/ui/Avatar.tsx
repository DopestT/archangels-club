import React from 'react';
import { cn } from '../../lib/utils';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  ring?: boolean;
}

const sizeMap = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
  '2xl': 'w-28 h-28 text-2xl',
};

export default function Avatar({ src, name, size = 'md', className, ring = false }: AvatarProps) {
  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div
      className={cn(
        'relative rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center',
        'bg-bg-hover border',
        ring ? 'border-gold shadow-gold-sm' : 'border-gold-border',
        sizeMap[size],
        className,
      )}
    >
      {src ? (
        <img src={src} alt={name ?? 'Avatar'} className="w-full h-full object-cover" />
      ) : (
        <span className="font-serif text-gold font-medium">{initials}</span>
      )}
    </div>
  );
}
