import path from 'node:path';

import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/renderer/app/entry/renderer-runtime-entry.ts'),
      name: 'MKPModernRendererRuntime',
      fileName: () => 'renderer-runtime.bundle.js',
      formats: ['iife']
    },
    outDir: path.resolve(__dirname, 'src/renderer/assets/js/generated'),
    emptyOutDir: false,
    sourcemap: false,
    minify: false,
    rollupOptions: {}
  }
});
