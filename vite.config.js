import { defineConfig } from 'vite'

export default defineConfig({
  // Portfolio-friendly static output: relative asset URLs work when the bundle
  // is served from a subdirectory such as /projects/multi-dim-viz/.
  base: './',
  // Keep the dev server local by default. Use `npm run dev -- --host 0.0.0.0`
  // only when you intentionally want LAN access.
  server: { open: false, host: '127.0.0.1' },
  build: { target: 'es2020' },
})
