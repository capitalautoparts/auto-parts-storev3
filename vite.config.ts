import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { createCatalogHandler } from './server/catalog-proxy.ts'
import { createProductPageHandler } from './server/product-page.ts'
import { readFile } from 'node:fs/promises'

// Only Vite's local server explicitly opts in. The Vercel function fails closed.
const catalogHandler = createCatalogHandler(fetch, process.env, true)

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'roysauto-staging-catalog',
    configureServer(server) {
      server.middlewares.use('/api/catalog', catalogHandler)
      const products = createProductPageHandler(async () => server.transformIndexHtml('/', await readFile('index.html', 'utf8')), fetch, process.env, true)
      server.middlewares.use((req, res, next) => { if (req.url?.startsWith('/products/')) return void products(req, res); next() })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/catalog', catalogHandler)
      const products = createProductPageHandler(() => readFile('dist/index.html', 'utf8'), fetch, process.env, true)
      server.middlewares.use((req, res, next) => { if (req.url?.startsWith('/products/')) return void products(req, res); next() })
    },
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
