import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'

export default defineConfig({
  plugins: [wasm()],
  // Rapier ships as wasm. Pre-bundling it breaks the instantiation, so it is excluded and
  // the wasm plugin handles it instead.
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
  resolve: { dedupe: ['three'] },
  // Both the wasm plugin and the top-level await used to reach getTools need a modern target.
  build: { target: 'esnext' }
})
