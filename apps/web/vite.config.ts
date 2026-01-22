import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  plugins: [
    UnoCSS(),
    tsconfigPaths(),
    tanstackStart(),
    react(),
  ],
  ssr: {
    external: ['@tensorflow/tfjs-node'],
  },
  build: {
    rollupOptions: {
      external: ['@tensorflow/tfjs-node'],
    },
  },
})
