import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// ─── PWA: registro de Service Worker con auto-actualización ───────────────────
// Tablets en bodega = dispositivos kiosko: actualizar sin pedir confirmación
// al usuario evita que se queden con versiones viejas del sistema.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registro) => {
        // Si ya hay un SW esperando al registrar, activarlo de inmediato
        if (registro.waiting) {
          registro.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Cuando se detecta una nueva versión instalada, activarla sin esperar
        registro.addEventListener('updatefound', () => {
          const nuevoWorker = registro.installing;
          if (!nuevoWorker) return;

          nuevoWorker.addEventListener('statechange', () => {
            if (nuevoWorker.state === 'installed' && navigator.serviceWorker.controller) {
              nuevoWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => console.error('Error registrando Service Worker:', err));

    // Cuando el nuevo SW toma control, recargar para servir la versión nueva
    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recargando) return;
      recargando = true;
      window.location.reload();
    });
  });
}