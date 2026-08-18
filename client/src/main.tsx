import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Deliberately not inside the Android app: there the page already comes from the APK, so the
// worker would add a second, longer-lived cache of the same files on top of it — one that
// outlives an app update and can keep serving the previous build's assets.
const isNativeShell = 'Capacitor' in window;

if ('serviceWorker' in navigator && import.meta.env.PROD && !isNativeShell) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
