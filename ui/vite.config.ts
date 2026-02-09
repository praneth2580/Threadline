import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@threadline/constants': path.resolve(__dirname, '../src/constants'),
    },
  },
  server: {
    port: Number(process.env.DEV_UI_PORT) || 5173,
    strictPort: true, // keep in sync with backend; change port via .env DEV_UI_PORT
    cors: true,
  },
})
