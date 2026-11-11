import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, resolve, dirname } from 'node:path'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PACKAGES_DIR = join(REPO_ROOT, 'packages')
const REPOSITORY_URL = 'git+https://github.com/cnotv/generative-art.git'

interface PackageManifest {
  private?: boolean
  repository?: { type?: string; url?: string; directory?: string }
}

const readManifest = (folder: string): PackageManifest =>
  JSON.parse(readFileSync(join(PACKAGES_DIR, folder, 'package.json'), 'utf8')) as PackageManifest

const publishedPackageFolders = (): string[] =>
  readdirSync(PACKAGES_DIR)
    .filter((folder) => existsSync(join(PACKAGES_DIR, folder, 'package.json')))
    .filter((folder) => !readManifest(folder).private)

describe('published package manifests', () => {
  // npm verifies a provenance-signed publish against repository.url and rejects the upload
  // with a 422 when the manifest does not name the repository that built it.
  it.each(publishedPackageFolders())('%s names this repository and its folder', (folder) => {
    const { repository } = readManifest(folder)

    expect(repository).toEqual({
      type: 'git',
      url: REPOSITORY_URL,
      directory: `packages/${folder}`
    })
  })
})
