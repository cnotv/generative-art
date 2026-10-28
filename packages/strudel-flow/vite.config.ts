import { defineConfig } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'WebGameKitStrudelFlow',
      fileName: 'index'
    },
    rollupOptions: {
      external: ['vue', '@vue-flow/core', '@vue-flow/controls', 'lucide-vue-next'],
      output: {
        globals: {
          vue: 'Vue',
          '@vue-flow/core': 'VueFlow',
          '@vue-flow/controls': 'VueFlowControls',
          'lucide-vue-next': 'lucideVueNext'
        }
      }
    }
  }
})
