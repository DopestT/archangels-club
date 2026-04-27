import React from 'react';

interface ContentWatermarkProps {
  opacity?: number;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'center';
  className?: string;
}

const POSITIONS = {
  'bottom-right': 'bottom-3 right-3',
  'bottom-left':  'bottom-3 left-3',
  'top-right':    'top-3 right-3',
  'center':       'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
};

export default function ContentWatermark({ opacity = 0.10, position = 'bottom-right', className = '' }: ContentWatermarkProps) {
  return (
    <div className={`absolute ${POSITIONS[position]} pointer-events-none select-none ${className}`}>
      <img
        src="/assets/brand/watermark-logo.svg"
        alt=""
        aria-hidden="true"
        className="w-28"
        style={{ opacity, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
        draggable={false}
      />
    </div>
  );
}
