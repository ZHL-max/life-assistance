import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/buaa': 'http://127.0.0.1:8787',
      '/api/app': 'http://127.0.0.1:8787',
    },
  },
})
