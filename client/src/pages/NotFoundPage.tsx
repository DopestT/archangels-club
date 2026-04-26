import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="font-serif text-8xl text-gold mb-4">404</p>
        <h1 className="font-serif text-3xl text-white mb-3">Page Not Found</h1>
        <p className="text-arc-secondary mb-8">
          This area doesn't exist or access is restricted.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/" className="btn-gold">Return Home</Link>
          <Link to="/explore" className="btn-outline">Explore</Link>
        </div>
      </div>
    </div>
  );
}
