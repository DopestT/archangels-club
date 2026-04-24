import React from 'react';

type LogoVariant = 'primary' | 'icon' | 'wordmark' | 'submark' | 'watermark';
type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
}

const SRC: Record<LogoVariant, string> = {
  primary:   '/assets/brand/primary-logo.svg',
  icon:      '/assets/brand/icon-logo.svg',
  wordmark:  '/assets/brand/wordmark-logo.svg',
  submark:   '/assets/brand/submark-logo.svg',
  watermark: '/assets/brand/watermark-logo.svg',
};

// Natural aspect ratios per variant
const DIMS: Record<LogoVariant, Record<LogoSize, { w: string; h: string }>> = {
  primary:   { sm: { w: '100px', h: '60px' },  md: { w: '160px', h: '96px' },  lg: { w: '220px', h: '132px' }, xl: { w: '300px', h: '180px' } },
  icon:      { sm: { w: '28px',  h: '28px' },  md: { w: '40px',  h: '40px' },  lg: { w: '56px',  h: '56px' },  xl: { w: '80px',  h: '80px' }  },
  wordmark:  { sm: { w: '120px', h: '18px' },  md: { w: '180px', h: '26px' },  lg: { w: '240px', h: '34px' },  xl: { w: '320px', h: '46px' }  },
  submark:   { sm: { w: '16px',  h: '16px' },  md: { w: '24px',  h: '24px' },  lg: { w: '32px',  h: '32px' },  xl: { w: '48px',  h: '48px' }  },
  watermark: { sm: { w: '80px',  h: '28px' },  md: { w: '120px', h: '40px' },  lg: { w: '160px', h: '54px' },  xl: { w: '200px', h: '68px' }  },
};

export default function Logo({ variant = 'wordmark', size = 'md', className = '' }: LogoProps) {
  const { w, h } = DIMS[variant][size];
  return (
    <img
      src={SRC[variant]}
      alt="Archangels Club"
      width={w}
      height={h}
      style={{ width: w, height: h, objectFit: 'contain', display: 'block' }}
      className={className}
      draggable={false}
    />
  );
}
