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
          animation: 'arcIn 0.9s cubic-bezier(0.4,0,0.2,1) forwards, arcShimmer 1.8s ease-in-out 0.9s infinite',
        }}
      />
      <style>{`
        @keyframes arcIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes arcShimmer {
          0%, 100% { filter: drop-shadow(0 0 5px rgba(212,175,55,0.20)); }
          50%       { filter: drop-shadow(0 0 12px rgba(212,175,55,0.50)); }
        }
      `}</style>
    </div>
  );
}
