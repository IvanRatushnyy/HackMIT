import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The design system lives in ./design and is imported directly by the app.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, fs: { allow: ['.'] } },
})
