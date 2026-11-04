import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { createCatalogHandler } from './server/catalog-proxy.ts'

// Only Vite's local server explicitly opts in. The Vercel function fails closed.
const catalogHandler = createCatalogHandler(fetch, process.env, true)

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'roysauto-staging-catalog',
    configureServer(server) { server.middlewares.use('/api/catalog', catalogHandler) },
    configurePreviewServer(server) { server.middlewares.use('/api/catalog', catalogHandler) },
  }],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
})
