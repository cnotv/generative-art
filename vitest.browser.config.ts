import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, 'e2e/*'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      server: {
        deps: {
          inline: ['@dimforge/rapier3d-compat']
        }
      },
      browser: {
        enabled: true,
        provider: playwright(),
        instances: [{
          browser: 'chromium'
        }],
        headless: process.env.CI === 'true',
        screenshotFailures: false
      }
    }
  })
)
