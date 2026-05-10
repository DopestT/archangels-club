import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

console.info(`[Archangels Club] build ${__BUILD_SHA__} — ${__BUILD_TIME__}`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
