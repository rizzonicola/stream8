import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registra il service worker che mantiene in cache lo "shell" dell'app
// (HTML/CSS/JS) per caricamenti quasi istantanei dopo la prima visita.
// Solo in produzione: in sviluppo interferirebbe con l'hot-reload di Vite.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // la registrazione può fallire (es. contesto non sicuro): non è
      // bloccante, l'app funziona comunque senza cache dello shell.
    });
  });
}
