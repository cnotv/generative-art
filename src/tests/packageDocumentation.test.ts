import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, resolve, dirname } from 'node:path'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PACKAGES_DIR = join(REPO_ROOT, 'packages')
const DOCS_DIR = join(REPO_ROOT, 'documentation/docs/packages')

/**
 * A directory under packages/ is only a real package once it exposes source. Directories
 * left holding nothing but a stale dist/ are build residue, not something to document.
 */
const sourcePackageNames = (): string[] =>
  readdirSync(PACKAGES_DIR)
    .filter((name) => statSync(join(PACKAGES_DIR, name)).isDirectory())
    .filter((name) => existsSync(join(PACKAGES_DIR, name, 'src/index.ts')))

/**
 * A page may document more than one package — the client and server halves of one wire
 * protocol are explained together — so the mapping is declared rather than inferred from
 * filenames. A package absent from this map falls back to a page of its own name.
 */
const PAGE_BY_PACKAGE: Record<string, string> = {
  'multiplayer-client': 'multiplayer-client-server',
  'multiplayer-server': 'multiplayer-client-server'
}

const pageFor = (packageName: string): string => PAGE_BY_PACKAGE[packageName] ?? packageName

const documentedPackageNames = (): string[] =>
  sourcePackageNames().filter((name) => existsSync(join(DOCS_DIR, `${pageFor(name)}.md`)))

describe('package documentation', () => {
  it('gives every package with source a page', () => {
    // A package nobody can read about is unusable to a stranger, which is the whole point of
    // publishing it. The check maps packages to pages so a shared page still counts.
    const undocumented = sourcePackageNames().filter(
      (name) => !documentedPackageNames().includes(name)
    )
    expect(undocumented).toEqual([])
  })

  it('points every declared page mapping at a page that exists', () => {
    const dangling = Object.values(PAGE_BY_PACKAGE).filter(
      (page) => !existsSync(join(DOCS_DIR, `${page}.md`))
    )
    expect(dangling).toEqual([])
  })

  it('names the package it documents in its own page', () => {
    // Catches a page copied from another package and renamed but never rewritten.
    const missingName = sourcePackageNames().filter((name) => {
      const page = join(DOCS_DIR, `${pageFor(name)}.md`)
      if (!existsSync(page)) return false
      return !readFileSync(page, 'utf8').includes(`@webgamekit/${name}`)
    })
    expect(missingName).toEqual([])
  })
})
