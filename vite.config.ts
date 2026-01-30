import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import wasm from 'vite-plugin-wasm'

const packages = ['animation', 'threejs', 'audio', 'game', 'controls'];
const packageAliases = Object.fromEntries(
  packages.map(pkg => [
    `@webgamekit/${pkg}`,
    fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url))
  ])
);

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [vue(), wasm()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...packageAliases
    },
    dedupe: ['three']
  },
  build: {
    target: 'esnext',
    sourcemap: true,
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
