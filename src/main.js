/**
 * main.js — Application entry point.
 *
 * Boots the App, hides the pre-render loading screen, and registers the service
 * worker for offline play. Kept intentionally tiny; all wiring lives in App.
 */
import { App } from './ui/App.js';

function boot() {
  const root = document.getElementById('app');
  const app = new App(root);
  app.start();

  // Reveal the app and fade out the static loading screen.
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('is-hidden');
    setTimeout(() => loading.remove(), 500);
  }

  // Expose for debugging in the console (non-enumerable, dev convenience).
  window.ArrowEscape = app;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Progressive Web App: offline support.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      /* offline support is a progressive enhancement */
    });
  });
}
