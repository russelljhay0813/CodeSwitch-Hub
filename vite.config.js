import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) return 'charts'
          if (/node_modules\/(react|react-dom|react-router|react-router-dom)\//.test(id)) return 'react-vendor'
        },
      },
    },
  },
})
