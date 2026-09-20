import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The design system lives in ./design and is imported directly by the app. The backend is a separate
// Python service under ./backend; its virtualenv and caches are not the app's to watch.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, fs: { allow: ['.'] }, watch: { ignored: ['**/backend/**'] } },
})
