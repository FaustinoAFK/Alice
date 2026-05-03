import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('@xyflow/react') ||
            id.includes('dagre') ||
            id.includes('html-to-image')
          ) {
            return 'mindmap-vendor'
          }

          if (id.includes('lucide-react')) {
            return 'ui-icons'
          }

          return undefined
        },
      },
    },
  },
})
