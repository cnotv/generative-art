import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    // ESM only: this package runs on Node, so a UMD build would never be loaded.
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        main: resolve(import.meta.dirname, 'src/main.ts')
      },
      formats: ['es']
    },
    rollupOptions: {
      external: ['socket.io', 'node:http']
    }
  }
})
