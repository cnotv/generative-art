// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { declaredEntryPaths } from './verify-packages.mjs'

describe('declaredEntryPaths', () => {
  it.each([
    {
      scenario: 'collects main, module and types',
      manifest: {
        main: './dist/index.umd.cjs',
        module: './dist/index.js',
        types: './dist/index.d.ts'
      },
      expected: ['./dist/index.umd.cjs', './dist/index.js', './dist/index.d.ts']
    },
    {
      scenario: 'walks nested conditional exports',
      manifest: {
        exports: {
          '.': {
            import: './dist/index.js',
            require: './dist/index.umd.cjs',
            types: './dist/index.d.ts'
          }
        }
      },
      expected: ['./dist/index.js', './dist/index.umd.cjs', './dist/index.d.ts']
    },
    {
      scenario: 'reports a path promised in two places only once',
      manifest: {
        module: './dist/index.js',
        exports: { '.': { import: './dist/index.js' } }
      },
      expected: ['./dist/index.js']
    },
    {
      scenario: 'ignores bare specifiers, which name a package rather than a file',
      manifest: { main: './dist/index.js', exports: { '.': { node: 'three' } } },
      expected: ['./dist/index.js']
    },
    {
      scenario: 'accepts a manifest that promises nothing',
      manifest: {},
      expected: []
    }
  ])('$scenario', ({ manifest, expected }) => {
    // Arrange is the manifest above; a manifest is the whole input.
    const entries = declaredEntryPaths(manifest)

    expect(entries).toEqual(expected)
  })
})
