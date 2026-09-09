import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'katex/dist/katex.min.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Initialize Lucide icons after React renders
if (typeof window !== 'undefined') {
  let isInitializing = false;

  const initLucide = (): void => {
    if (isInitializing) return;
    isInitializing = true;
    try {
      const w = window as unknown as { lucide?: { createIcons?: () => void } };
      if (w.lucide && typeof w.lucide.createIcons === 'function') {
        w.lucide.createIcons();
      }
    } finally {
      isInitializing = false;
    }
  };

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLucide);
  } else {
    initLucide();
  }

  // Re-initialize after React updates - use a debounced approach to avoid infinite loops
  let observerTimeout: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver((): void => {
    if (isInitializing) return;
    if (observerTimeout) clearTimeout(observerTimeout);
    observerTimeout = setTimeout(() => {
      initLucide();
    }, 10);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}