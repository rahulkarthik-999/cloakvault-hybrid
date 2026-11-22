import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/ai', 'firebase/app-check', 'firebase/auth', 'firebase/firestore', 'firebase/remote-config'],
          pdf: ['pdfjs-dist'],
          docx: ['mammoth'],
        },
      },
    },
  },
});
