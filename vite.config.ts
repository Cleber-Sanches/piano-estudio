import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: funciona no GitHub Pages (/piano-estudio/) e localmente
export default defineConfig({
  base: './',
  plugins: [react()],
});
