import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import wasm from 'vite-plugin-wasm'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), wasm()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@webgametoolkit/animation': fileURLToPath(new URL('./packages/animation/src/index.ts', import.meta.url)),
      '@webgametoolkit/threejs': fileURLToPath(new URL('./packages/threejs/src/index.ts', import.meta.url))
    }
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      treeshake: false,
    }
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']
  },
  server: {
    allowedHosts: ['cnotv.xyz', 'test.cnotv.xyz', 'game.cnotv.xyz'],
  },
})
