import React from 'react';

interface State { error: Error | null; didReload: boolean }

function isChunkError(err: Error): boolean {
  return (
    err.message.includes('Failed to fetch dynamically imported module') ||
    err.message.includes('Importing a module script failed') ||
    err.message.includes('error loading dynamically imported module') ||
    err.message.includes('Unable to preload CSS for')
  );
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null, didReload: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);

    // Auto-reload once on chunk load failures (stale deployment)
    if (isChunkError(error)) {
      const key = 'arc_chunk_refresh';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        this.setState({ didReload: true });
      }
    }
  }

  render() {
    const { error, didReload } = this.state;

    if (!error) return this.props.children;

    // Chunk error — show a friendly "updating" screen while reload fires
    if (isChunkError(error) || didReload) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#09090B',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '2rem',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '2px solid rgba(212,175,55,0.25)',
            borderTopColor: '#D4AF37',
            animation: 'spin 0.8s linear infinite',
            marginBottom: 24,
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{
            color: 'rgba(255,255,255,0.7)', fontSize: 14,
            fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 8,
          }}>
            Loading updated version…
          </p>
          <p style={{
            color: 'rgba(255,255,255,0.3)', fontSize: 12,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            If this persists, try a hard refresh (⌘⇧R / Ctrl+Shift+R)
          </p>
        </div>
      );
    }

    // Other errors — full crash report
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
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 20, padding: '8px 24px', background: '#D4AF37',
            color: '#09090B', border: 'none', borderRadius: 8,
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >
          Reload page
        </button>
      </div>
    );
  }
}
