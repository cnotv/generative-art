import { fileURLToPath } from 'node:url'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import viteConfig from './vite.config'

const pnpmStore = join(process.cwd(), 'node_modules', '.pnpm')
const strudelAlias = existsSync(pnpmStore)
  ? readdirSync(pnpmStore)
      .filter((entry) => entry.startsWith('@strudel+'))
      .map((entry) => {
        const atIndex = entry.indexOf('@', 1)
        if (atIndex === -1) {
          return undefined
        }
        const packageName = `@strudel/${entry.slice(atIndex + 1).split('@')[0]}`
        return [packageName, join(pnpmStore, entry, 'node_modules', packageName)] as const
      })
      .filter((pair): pair is readonly [string, string] => pair !== undefined)
      .reduce<Record<string, string>>((alias, [packageName, path]) => {
        alias[packageName] = path
        return alias
      }, {})
  : {}

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      alias: {
        ...strudelAlias
      }
    },
    test: {
      include: ['**/*.browser.test.ts'],
      exclude: [...configDefaults.exclude, 'e2e/*'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      testTimeout: 6000,
      hookTimeout: 2000,
      server: {
        deps: {
          inline: [
            '@dimforge/rapier3d-compat',
            '@strudel/core',
            '@strudel/mini',
            '@strudel/webaudio',
            '@strudel/tonal',
            '@strudel/transpiler',
            'superdough'
          ],
          optimize: ['vue', 'vue-router', 'pinia', 'three', 'stats.js', '@vue/test-utils']
        }
      },
      browser: {
        enabled: true,
        provider: playwright(),
        instances: [
          {
            browser: 'chromium'
          }
        ],
        headless: true,
        screenshotFailures: false
      }
    }
  })
)
