import React from 'react';

export default function SplashScreen() {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#09090B',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <img
        src="/assets/logo/icon.png"
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{
          width: 64,
          height: 64,
          transformOrigin: 'center bottom',
          animation: 'pixar-splash 1.0s cubic-bezier(0.22,1,0.36,1) both, arcShimmer 1.8s ease-in-out 1.0s infinite',
        }}
      />
      <style>{`
        @keyframes arcShimmer {
          0%, 100% { filter: drop-shadow(0 0 5px rgba(212,175,55,0.20)); }
          50%       { filter: drop-shadow(0 0 14px rgba(212,175,55,0.55)); }
        }
      `}</style>
    </div>
  );
}
