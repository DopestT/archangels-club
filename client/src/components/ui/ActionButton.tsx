import React, { useState } from 'react';

interface ActionButtonProps {
  label: React.ReactNode;
  loadingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  onAction: () => Promise<unknown>;
  onSuccess?: () => void;
  className?: string;
}

export default function ActionButton({
  label,
  loadingLabel = 'Processing…',
  successLabel = 'Done',
  errorLabel = 'Try again',
  onAction,
  onSuccess,
  className = '',
}: ActionButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleClick() {
    if (state === 'loading') return;
    try {
      setState('loading');
      await onAction();
      setState('success');
      if (onSuccess) onSuccess();
      setTimeout(() => setState('idle'), 1300);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 1300);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className={`motion-action ${state} ${className}`}
    >
      {state === 'success' && (
        <span className="lock-feedback">
          <span className="lock-ring" />
          <span className="lock-check">✓</span>
        </span>
      )}
      <span className="action-label">
        {state === 'idle'    && label}
        {state === 'loading' && loadingLabel}
        {state === 'success' && successLabel}
        {state === 'error'   && errorLabel}
      </span>
    </button>
  );
}
