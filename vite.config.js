import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset URLs so the built bundle works when served from a
  // subdirectory (e.g. a GitHub Pages project site or a school website).
  base: './',
  // Keep the dev server local by default. Use `npm run dev -- --host 0.0.0.0`
  // only when you intentionally want LAN access.
  server: { open: false, host: '127.0.0.1' },
  build: { target: 'es2020' },
})
