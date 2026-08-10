import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, resolve, dirname } from 'node:path'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PACKAGES_DIR = join(REPO_ROOT, 'packages')

/**
 * A directory under packages/ is only a real package once it exposes source. Directories
 * left holding nothing but a stale dist/ are build residue, not something Vite must alias.
 */
const sourcePackageNames = (): string[] =>
  readdirSync(PACKAGES_DIR)
    .filter((name) => statSync(join(PACKAGES_DIR, name)).isDirectory())
    .filter((name) => existsSync(join(PACKAGES_DIR, name, 'src/index.ts')))

const registeredPackageNames = (): string[] => {
  const config = readFileSync(join(REPO_ROOT, 'vite.config.ts'), 'utf8')
  const arrayBody = config.match(/const packages\s*=\s*\[([\S\s]*?)]/)?.[1] ?? ''
  return [...arrayBody.matchAll(/["']([^"']+)["']/g)].map((match) => match[1])
}

describe('vite package registration', () => {
  it('registers every package that has source', () => {
    // An unregistered package resolves through node_modules to its built dist. When that
    // build is stale or missing an export the app throws a runtime SyntaxError, in dev
    // and in Docker alike, while the source looks perfectly correct.
    const missing = sourcePackageNames().filter((name) => !registeredPackageNames().includes(name))
    expect(missing).toEqual([])
  })

  it('does not register packages that no longer have source', () => {
    const stale = registeredPackageNames().filter((name) => !sourcePackageNames().includes(name))
    expect(stale).toEqual([])
  })
})
