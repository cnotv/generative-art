import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Importing the full Vite config pulls in plugins/esbuild that misbehave under
// jsdom, so this guards the setting at the source level instead: it must keep
// compiling SCSS with the modern Sass API, never the deprecated legacy JS API.
const source = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf-8')

describe('vite config SCSS', () => {
  it('configures the modern Sass compiler API', () => {
    expect(source).toMatch(/preprocessorOptions/)
    expect(source).toMatch(/scss:\s*{[\S\s]*?api:\s*["']modern-compiler["']/)
  })
})
