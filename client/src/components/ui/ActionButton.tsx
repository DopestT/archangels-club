import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { runAction, type ActionResult } from '../../lib/runAction';

type Phase = 'idle' | 'loading' | 'success' | 'error';

interface ActionButtonProps<T = unknown> {
  label: React.ReactNode;
  apiCall: () => Promise<Response>;
  successLabel?: string;
  className?: string;
  disabled?: boolean;
  onSuccess?: (result: ActionResult<T>) => void;
}

export default function ActionButton<T = unknown>({
  label,
  apiCall,
  successLabel,
  className = '',
  disabled = false,
  onSuccess,
}: ActionButtonProps<T>) {
  const [state, setState] = useState<Phase>('idle');
  const [message, setMessage] = useState('');
  const [nextAction, setNextAction] = useState<ActionResult['nextAction']>(undefined);

  async function handleClick() {
    if (state === 'loading' || disabled) return;
    setState('loading');
    setMessage('Processing…');

    const result = await runAction<T>(apiCall);

    setState(result.state);
    setMessage(result.message || (result.state === 'success' ? (successLabel ?? '✔') : 'Something went wrong'));

    if (result.nextAction) setNextAction(result.nextAction);
    if (result.state === 'success' && onSuccess) onSuccess(result);

    setTimeout(() => {
      setState('idle');
      setMessage('');
      setNextAction(undefined);
    }, 1400);
  }

  return (
    <div style={{ display: 'contents' }}>
      <button
        onClick={handleClick}
        disabled={disabled || state === 'loading'}
        className={className}
        style={{
          transform: state === 'loading' ? 'scale(0.97)' : 'scale(1)',
          transition: 'transform 0.2s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {state === 'idle'    && label}
        {state === 'loading' && 'Processing…'}
        {state === 'success' && `✔ ${message}`}
        {state === 'error'   && message}
      </button>

      {state === 'success' && nextAction && (
        <span
          style={{ animation: 'arcConfirmIn 200ms cubic-bezier(.2,.8,.2,1) both' }}
          className="block text-xs text-gold mt-1.5 pl-0.5"
        >
          {nextAction.href ? (
            <Link to={nextAction.href} className="hover:underline">
              → {nextAction.label}
            </Link>
          ) : (
            <span className="opacity-70">→ {nextAction.label}</span>
          )}
        </span>
      )}
    </div>
  );
}
