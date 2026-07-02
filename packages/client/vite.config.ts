import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envDir: '../..',
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3001',
      },
    },
  },
})
