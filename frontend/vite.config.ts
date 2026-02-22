import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/health': 'http://127.0.0.1:8020',
      '/v1': {
        target: 'http://127.0.0.1:8020',
        ws: true,
      },
      '/_local': 'http://127.0.0.1:8020',
      '/ws': {
        target: 'ws://127.0.0.1:8020',
        ws: true,
      },
    },
  },
})
