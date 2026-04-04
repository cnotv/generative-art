import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'WebGameToolkitMultiplayer',
      fileName: 'index'
    },
    rollupOptions: {
      external: ['socket.io-client'],
      output: {
        globals: {
          'socket.io-client': 'io'
        }
      }
    }
  }
})
