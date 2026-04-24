import React from 'react';
import Logo from '../brand/Logo';

interface LinkInBioLayoutProps {
  children: React.ReactNode;
  backgroundUrl?: string;
}

export default function LinkInBioLayout({ children, backgroundUrl }: LinkInBioLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10 bg-bg-primary"
      style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
      {backgroundUrl && <div className="fixed inset-0 bg-bg-primary/80 backdrop-blur-sm" />}

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8">
          <Logo variant="primary" size="md" />
        </div>
        {children}
      </div>
    </div>
  );
}
