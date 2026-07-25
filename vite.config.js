import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  root: 'src/renderer',
  plugins: [react()],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html'),
        screenshotSelection: resolve(__dirname, 'src/renderer/screenshot-selection.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true
  },
  base: './'
})
