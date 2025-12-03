import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'WebGameToolkitThreejs',
      fileName: 'index',
    },
    rollupOptions: {
      external: ['three', '@dimforge/rapier3d-compat', '@webgametoolkit/animation'],
      output: {
        globals: {
          three: 'THREE',
          '@dimforge/rapier3d-compat': 'RAPIER',
          '@webgametoolkit/animation': 'WebGameToolkitAnimation',
        },
      },
    },
  },
});
