import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './dream-drift.css';
import App from './App';
import { installAudioUnlock } from './lib/audioUnlock';

console.info(`[Archangels Club] build ${__BUILD_SHA__} — ${__BUILD_TIME__}`);

// Prime audio playback so the first live-gift sound (fired from a socket event,
// not a click) isn't blocked by the browser autoplay policy. Unlocks on the
// user's first gesture anywhere in the app.
installAudioUnlock();

// When a Vite code-split chunk 404s (stale deployment in browser cache),
// auto-reload once so the fresh index.html and new chunk hashes load.
window.addEventListener('vite:preloadError', () => {
  const key = 'arc_chunk_refresh';
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1');
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
