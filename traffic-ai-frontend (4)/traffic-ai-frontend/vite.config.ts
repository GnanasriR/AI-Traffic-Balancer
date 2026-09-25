import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/optimizer': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/optimizer': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/incidents': {
        target: 'http://localhost:8084',
        changeOrigin: true,
      },
      '/api/v1/incidents': {
        target: 'http://localhost:8084',
        changeOrigin: true,
      },
      '/api/analytics': {
        target: 'http://localhost:8085',
        changeOrigin: true,
      },
      '/api/v1/analytics': {
        target: 'http://localhost:8085',
        changeOrigin: true,
      },
      '/api/v1/auth': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/api/v1/admin': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
})
