import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES_DIR = join(REPO_ROOT, 'packages')

/**
 * Peer and optional dependencies the packages expect the consumer to bring. The smoke project
 * is that consumer, so it has to supply them or every import fails for the wrong reason.
 */
const CONSUMER_DEPENDENCIES = {
  three: '^0.178.0',
  '@dimforge/rapier3d-compat': '^0.19.3',
  'socket.io': '^4.8.0',
  'socket.io-client': '^4.8.1',
  trystero: '^0.23.0',
  typescript: '~5.4.0'
}

/**
 * Entries a manifest promises a consumer. `exports` is walked rather than read at a fixed depth
 * because a conditional export can nest arbitrarily, and every leaf is a file someone will load.
 */
export const declaredEntryPaths = (manifest) => {
  const fromExports = (node) => {
    if (typeof node === 'string') return [node]
    if (node && typeof node === 'object') return Object.values(node).flatMap(fromExports)
    return []
  }

  return [
    ...[manifest.main, manifest.module, manifest.types].filter(Boolean),
    ...fromExports(manifest.exports)
  ]
    .filter((entry) => entry.startsWith('./') || entry.startsWith('dist/'))
    .filter((entry, index, all) => all.indexOf(entry) === index)
}

/**
 * A directory under packages/ is only a real package once it exposes source. Directories left
 * holding nothing but a stale dist/ are build residue, not something to publish or verify.
 */
const publishablePackages = () =>
  readdirSync(PACKAGES_DIR)
    .filter((name) => existsSync(join(PACKAGES_DIR, name, 'src/index.ts')))
    .map((name) => ({
      name,
      directory: join(PACKAGES_DIR, name),
      manifest: JSON.parse(readFileSync(join(PACKAGES_DIR, name, 'package.json'), 'utf8'))
    }))
    .filter(({ manifest }) => manifest.private !== true)

const missingEntries = ({ directory, manifest }) =>
  declaredEntryPaths(manifest)
    .filter((entry) => !existsSync(join(directory, entry)))
    .map((entry) => `${manifest.name} promises ${entry}, which the build did not emit`)

const run = (command, options) =>
  execFileSync(command, options.arguments_, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.quiet ? 'pipe' : 'inherit'
  })

const packTarball = ({ directory }, destination) => {
  run('pnpm', {
    arguments_: ['pack', '--pack-destination', destination],
    cwd: directory,
    quiet: true
  })
  const packed = readdirSync(destination).find((file) => file.endsWith('.tgz'))
  return packed
}

/**
 * Each package is packed into its own directory so the tarball can be identified by position
 * rather than by guessing the filename pnpm chose from name and version.
 */
const packAll = (packages, workspace) =>
  packages.map((package_) => {
    const destination = join(workspace, 'tarballs', package_.name)
    run('mkdir', { arguments_: ['-p', destination], cwd: workspace, quiet: true })
    return { ...package_, tarball: join(destination, packTarball(package_, destination)) }
  })

const writeSmokeProject = (packed, projectDirectory) => {
  const dependencies = Object.fromEntries(
    packed.map(({ manifest, tarball }) => [manifest.name, `file:${tarball}`])
  )

  writeFileSync(
    join(projectDirectory, 'package.json'),
    JSON.stringify(
      {
        name: 'webgamekit-smoke',
        private: true,
        type: 'module',
        dependencies: { ...dependencies, ...CONSUMER_DEPENDENCIES }
      },
      undefined,
      2
    )
  )

  const importable = packed.filter(({ manifest }) => manifest.exports?.['.']?.import)
  const requirable = packed.filter(({ manifest }) => manifest.exports?.['.']?.require)

  writeFileSync(
    join(projectDirectory, 'smoke.mjs'),
    [
      ...importable.map(
        ({ manifest }, index) => `import * as module${index} from '${manifest.name}'`
      ),
      ...importable.map(
        ({ manifest }, index) =>
          `if (Object.keys(module${index}).length === 0) throw new Error('${manifest.name} exports nothing from its ESM entry')`
      ),
      `console.log('ESM entries imported: ${importable.length}')`
    ].join('\n')
  )

  writeFileSync(
    join(projectDirectory, 'smoke.cjs'),
    [
      ...requirable.map(
        ({ manifest }, index) =>
          `const module${index} = require('${manifest.name}')\nif (Object.keys(module${index}).length === 0) throw new Error('${manifest.name} exports nothing from its CJS entry')`
      ),
      `console.log('CJS entries required: ${requirable.length}')`
    ].join('\n')
  )

  writeFileSync(
    join(projectDirectory, 'smoke.ts'),
    [
      ...packed.map(({ manifest }, index) => `import * as module${index} from '${manifest.name}'`),
      ...packed.map(
        ({ manifest }, index) => `void (module${index} satisfies object) // ${manifest.name}`
      )
    ].join('\n')
  )

  writeFileSync(
    join(projectDirectory, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ESNext',
          module: 'ESNext',
          moduleResolution: 'bundler',
          lib: ['ESNext', 'DOM'],
          strict: true,
          skipLibCheck: true,
          noEmit: true
        },
        files: ['smoke.ts']
      },
      undefined,
      2
    )
  )

  return { importable, requirable }
}

const main = () => {
  const packages = publishablePackages()
  if (packages.length === 0) throw new Error('No publishable packages found under packages/')

  const notEmitted = packages.flatMap(missingEntries)
  if (notEmitted.length > 0) {
    throw new Error(`Declared entry points missing from the build:\n  ${notEmitted.join('\n  ')}`)
  }
  console.log(`Declared entry points present for ${packages.length} packages`)

  const workspace = mkdtempSync(join(tmpdir(), 'webgamekit-verify-'))
  const projectDirectory = join(workspace, 'consumer')
  run('mkdir', { arguments_: ['-p', projectDirectory], cwd: workspace, quiet: true })

  try {
    const packed = packAll(packages, workspace)
    console.log(`Packed ${packed.length} tarballs`)

    writeSmokeProject(packed, projectDirectory)

    run('npm', {
      arguments_: ['install', '--no-audit', '--no-fund', '--loglevel', 'error'],
      cwd: projectDirectory
    })

    run('node', { arguments_: ['smoke.mjs'], cwd: projectDirectory })
    run('node', { arguments_: ['smoke.cjs'], cwd: projectDirectory })
    run('npx', { arguments_: ['tsc', '--project', 'tsconfig.json'], cwd: projectDirectory })
    console.log('Types resolve from the installed packages')
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
