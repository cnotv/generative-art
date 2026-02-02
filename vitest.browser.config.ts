import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['**/*.browser.test.ts'],
      exclude: [...configDefaults.exclude, 'e2e/*'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      server: {
        deps: {
          inline: ['@dimforge/rapier3d-compat'],
          optimize: [
            'vue',
            'vue-router',
            'pinia',
            'three',
            'stats.js',
            '@vue/test-utils'
          ]
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
