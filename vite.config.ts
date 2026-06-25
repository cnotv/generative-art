import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import wasm from 'vite-plugin-wasm'

const packages = [
  'animation',
  'threejs',
  'audio',
  'music',
  'game',
  'controls',
  'recording',
  'logic',
  'multiplayer-p2p',
  'dictionary',
  'chat',
  'canvas-editor'
]
const packageAliases = Object.fromEntries(
  packages.map((package_) => [
    `@webgamekit/${package_}`,
    fileURLToPath(new URL(`./packages/${package_}/src/index.ts`, import.meta.url))
  ])
)

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
  css: {
    preprocessorOptions: {
      // Use Dart Sass's modern compiler API; the default legacy JS API is
      // deprecated (https://sass-lang.com/d/legacy-js-api) and removed in Sass 2.
      scss: {
        api: 'modern-compiler'
      }
    }
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      treeshake: false
    }
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat', 'trystero', 'trystero/nostr']
  },
  server: {
    allowedHosts: ['cnotv.xyz', 'test.cnotv.xyz', 'game.cnotv.xyz', 'cnotv.github.io']
  }
})
