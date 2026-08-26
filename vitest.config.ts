import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      // .claude/worktrees holds throwaway checkouts of this same repo, so collecting them
      // runs a second copy of every test against whatever branch happens to be sitting there.
      exclude: [
        ...configDefaults.exclude,
        'e2e/*',
        '**/*.browser.test.ts',
        'rules/**',
        '.claude/worktrees/**'
      ],
      root: fileURLToPath(new URL('./', import.meta.url)),
      server: {
        deps: {
          inline: ['@dimforge/rapier3d-compat']
        }
      }
    }
  })
)
