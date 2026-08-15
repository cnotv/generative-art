import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/server.ts'),
      formats: ['es'],
      fileName: 'server'
    },
    rollupOptions: {
      external: ['socket.io', 'node:http', '@webgamekit/multiplayer-server']
    }
  }
})
