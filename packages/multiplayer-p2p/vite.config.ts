import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'WebGameToolkitMultiplayerP2P',
      fileName: 'index'
    },
    rollupOptions: {
      external: ['trystero', 'trystero/nostr'],
      output: { globals: { trystero: 'trystero', 'trystero/nostr': 'trysteroNostr' } }
    }
  }
})
