import { defineConfig } from 'vite';

// Deployment copies dist/ and server/, with neither src/ nor node_modules/.
// Bundle React and the view explicitly; only Node built-ins remain external.
export default defineConfig({
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: 'server/product-renderer.ts', outDir: 'dist/server', emptyOutDir: true,
    target: 'node22', minify: false,
    rollupOptions: { output: { entryFileNames: 'product-renderer.js' } },
  },
});
