import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Tier 1 Google Maps Platform quota & auth listener at module root
(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const isExtensionError = (source?: string, stack?: string, message?: string): boolean => {
  const combined = `${source || ''}\n${stack || ''}\n${message || ''}`;
  return (
    combined.includes('chrome-extension://') ||
    combined.includes('moz-extension://') ||
    combined.includes('Failed to connect to MetaMask')
  );
};

const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const combined = args
    .map((a) => (a instanceof Error ? `${a.message}\n${a.stack || ''}` : String(a)))
    .join(' ');
  if (isExtensionError(undefined, undefined, combined)) {
    return;
  }
  origConsoleError.apply(console, args);
  if (combined.includes('OverQuotaMapError') || combined.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

window.addEventListener(
  'error',
  (event) => {
    const errStack = event.error instanceof Error ? event.error.stack : undefined;
    if (isExtensionError(event.filename, errStack, event.message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);

window.addEventListener(
  'unhandledrejection',
  (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason || '');
    const stack = reason instanceof Error ? reason.stack : undefined;
    if (isExtensionError(undefined, stack, msg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(<App />);
