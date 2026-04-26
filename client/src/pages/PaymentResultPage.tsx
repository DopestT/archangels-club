import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';

interface Props {
  type: 'success' | 'cancel';
}

export default function PaymentResultPage({ type }: Props) {
  const isSuccess = type === 'success';

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {isSuccess ? (
          <CheckCircle className="w-16 h-16 text-gold mx-auto mb-6" />
        ) : (
          <XCircle className="w-16 h-16 text-arc-secondary mx-auto mb-6" />
        )}
        <h1 className="font-serif text-3xl text-white mb-3">
          {isSuccess ? 'Payment Successful' : 'Payment Cancelled'}
        </h1>
        <p className="text-arc-secondary mb-8">
          {isSuccess
            ? 'Your purchase is confirmed. Enjoy your content.'
            : 'Your payment was cancelled. No charge was made.'}
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/dashboard" className="btn-gold">Go to Dashboard</Link>
          <Link to="/explore" className="btn-outline">Explore</Link>
        </div>
      </div>
    </div>
  );
}
