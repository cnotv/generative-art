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
      external: ['three', '@dimforge/rapier3d-compat', '@webgamekit/animation'],
      output: {
        globals: {
          three: 'THREE',
          '@dimforge/rapier3d-compat': 'RAPIER',
          '@webgamekit/animation': 'WebGameToolkitAnimation',
        },
      },
    },
  },
});
