import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy all backend routes through Vite → eliminates CORS in dev
      '/incidents': 'http://127.0.0.1:8000',
      '/cameras':   'http://127.0.0.1:8000',
      '/demo':      'http://127.0.0.1:8000',
      '/uploads':   'http://127.0.0.1:8000',
      '/evidence':  'http://127.0.0.1:8000',
    },
  },
})
