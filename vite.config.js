import { defineConfig } from 'vite'

export default defineConfig({
  server: { open: false, host: true },
  build: { target: 'es2020' },
})
