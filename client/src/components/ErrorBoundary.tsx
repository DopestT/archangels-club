import React from 'react';

interface State { error: Error | null }

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#09090B',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '2rem', fontFamily: 'monospace',
        }}>
          <p style={{ color: '#D4AF37', fontSize: 14, marginBottom: 12 }}>
            App crash — copy this and report it:
          </p>
          <pre style={{
            color: '#f87171', fontSize: 12, background: '#18181b',
            padding: '1rem', borderRadius: 8, maxWidth: 680,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            border: '1px solid rgba(248,113,113,0.2)',
          }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 20, padding: '8px 24px', background: '#D4AF37',
              color: '#09090B', border: 'none', borderRadius: 8,
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
