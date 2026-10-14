import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // `npm run server` (optional) provides progress sync and visit counts
  server: { proxy: { '/api': 'http://localhost:8787' } },
})
