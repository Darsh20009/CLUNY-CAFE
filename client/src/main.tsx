import "./lib/i18n";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register Service Worker for PWA (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Capture whether a SW was already controlling this page BEFORE we register.
  // If null → first install (no reload needed).
  // If non-null → there was an old SW → any controller change means a real update.
  const hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
    // Force check for updates immediately
    registration.update().catch(() => {});
    console.log('ServiceWorker registration successful');

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          // Only show "update available" banner if this is a real update
          // (an old SW was already running), not a first-time install.
          if (
            newWorker.state === 'activated' &&
            navigator.serviceWorker.controller &&
            hadController
          ) {
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      }
    });

    // Check for SW updates every 30 minutes
    setInterval(() => {
      registration.update();
    }, 30 * 60 * 1000);
  }).catch(registrationError => {
    console.log('SW registration failed: ', registrationError);
  });

  // Auto-reload when a new service worker takes control — but ONLY
  // if there was already a controller before (i.e. a real update, not first install).
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading && hadController) {
      reloading = true;
      window.location.reload();
    }
  });
}
