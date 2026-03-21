import path from 'node:path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/renderer/react-app/entry/react-pages-entry.tsx'),
      name: 'MKPReactPagesBundle',
      fileName: () => 'react-pages.bundle.js',
      formats: ['iife']
    },
    outDir: path.resolve(__dirname, 'src/renderer/assets/js/generated'),
    emptyOutDir: false,
    sourcemap: false,
    minify: false,
    rollupOptions: {}
  }
});
