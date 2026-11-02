import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // In development, send /api calls to the Node server (npm run server).
  server: { proxy: { '/api': 'http://localhost:8787' } },
})
