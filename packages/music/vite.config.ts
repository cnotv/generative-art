import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'WebGameToolkitMusic',
      fileName: 'index'
    },
    rollupOptions: {
      // Strudel is provided by the consuming app; keep it out of the library bundle.
      external: ['@strudel/web'],
      output: {
        globals: {}
      }
    }
  }
})
