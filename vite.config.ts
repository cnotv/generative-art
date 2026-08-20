import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import wasm from 'vite-plugin-wasm'
import basicSsl from '@vitejs/plugin-basic-ssl'

const packages = [
  'animation',
  'threejs',
  'audio',
  'game',
  'controls',
  'recording',
  'logic',
  'multiplayer-p2p',
  'multiplayer-client',
  'multiplayer-server',
  'dictionary',
  'chat',
  'canvas-editor'
]
const allowedHosts = ['cnotv.xyz', 'test.cnotv.xyz', 'game.cnotv.xyz', 'cnotv.github.io']

const packageAliases = Object.fromEntries(
  packages.map((package_) => [
    `@webgamekit/${package_}`,
    fileURLToPath(new URL(`./packages/${package_}/src/index.ts`, import.meta.url))
  ])
)

// The device orientation and fullscreen APIs only work in a secure context, so reaching the
// dev server from a phone over the LAN needs HTTPS. Opt in with VITE_HTTPS=1 (pnpm dev:mobile)
// rather than always, since the self-signed certificate costs a browser warning on every start.
const useHttps = process.env.VITE_HTTPS === '1'

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [vue(), wasm(), ...(useHttps ? [basicSsl()] : [])],
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
    allowedHosts
  },
  preview: {
    allowedHosts
  }
})
