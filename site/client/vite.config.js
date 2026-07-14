import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    clearMocks: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/content': 'http://localhost:3000',
      // Generated image cache lives in public/assets/generated and is served by
      // Express. Without this, vite returns its SPA index.html for image URLs.
      '/assets': 'http://localhost:3000',
    },
    allowedHosts: [
      "engaged-assembled-runs-vary.trycloudflare.com",
    ],
  },
})
