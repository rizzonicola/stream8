import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Stream8 - configurazione Vite. Applicazione 100% client-side.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Le dipendenze (React, MUI) cambiano molto meno spesso del codice
        // dell'app: separandole in un chunk proprio, il loro hash resta
        // stabile tra un deploy e l'altro. Combinato con la cache del
        // service worker, gli utenti che hanno già visitato l'app scaricano
        // di nuovo solo il piccolo chunk applicativo, non l'intero bundle.
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-mui': ['@mui/material', '@mui/icons-material'],
        },
      },
    },
  },
});
