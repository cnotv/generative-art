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
      testTimeout: 6000,
      hookTimeout: 2000,
      server: {
        deps: {
          inline: ['@dimforge/rapier3d-compat'],
          optimize: ['vue', 'vue-router', 'pinia', 'three', 'stats.js', '@vue/test-utils']
        }
      },
      browser: {
        enabled: true,
        // Playback tests start real audio; muted, they still count buffers without reaching
        // whoever is wearing headphones.
        provider: playwright({ launchOptions: { args: ['--mute-audio'] } }),
        instances: [
          {
            browser: 'chromium'
          }
        ],
        headless: true, // Always run headless for faster tests
        screenshotFailures: false
      }
    }
  })
)
