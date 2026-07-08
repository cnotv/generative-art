import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'WebGameToolkitMultiplayerServer',
      fileName: 'index'
    },
    rollupOptions: {
      external: ['socket.io'],
      output: { globals: { 'socket.io': 'io' } }
    }
  }
})
