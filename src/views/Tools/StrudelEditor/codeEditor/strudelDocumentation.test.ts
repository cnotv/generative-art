import { readdirSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { format, resolveConfig } from 'prettier'
import { buildStrudelDocumentationIndex } from './parseStrudelDocumentation'
import strudelDocumentation from './strudelDocumentation.json'

const TEST_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const GENERATED_DOCUMENTATION_PATH = join(TEST_DIRECTORY, 'strudelDocumentation.json')
const REPOSITORY_ROOT = resolve(TEST_DIRECTORY, '../../../../..')
const DOCUMENTED_PACKAGES = [
  'core',
  'mini',
  'tonal',
  'webaudio',
  'draw',
  'transpiler',
  'codemirror'
]

const resolvePackageDirectory = (packageName: string): string =>
  realpathSync(join(REPOSITORY_ROOT, 'node_modules', '@strudel', packageName))

const readModuleSources = (packageDirectory: string): string[] =>
  readdirSync(packageDirectory)
    .filter((fileName) => fileName.endsWith('.mjs'))
    .sort()
    .map((fileName) => readFileSync(join(packageDirectory, fileName), 'utf8'))

// superdough is not a direct dependency, so it is found beside the @strudel/webaudio that pulls it in.
const superdoughDirectory = (): string =>
  resolve(resolvePackageDirectory('webaudio'), '../../superdough')

const generateStrudelDocumentation = async (): Promise<string> => {
  const sourceTexts = [
    ...DOCUMENTED_PACKAGES.flatMap((packageName) =>
      readModuleSources(resolvePackageDirectory(packageName))
    ),
    ...readModuleSources(superdoughDirectory())
  ]
  const widgetSource = readFileSync(
    join(resolvePackageDirectory('codemirror'), 'widget.mjs'),
    'utf8'
  )
  const prettierConfig = await resolveConfig(GENERATED_DOCUMENTATION_PATH)
  return format(JSON.stringify(buildStrudelDocumentationIndex(sourceTexts, widgetSource)), {
    ...prettierConfig,
    parser: 'json'
  })
}

describe('strudelDocumentation.json', () => {
  // Generated from the installed Strudel sources: after upgrading a @strudel package, rerun this
  // file with `pnpm vitest run src/views/Tools/StrudelEditor/codeEditor/strudelDocumentation.test.ts -u`.
  it('matches the docs generated from the installed Strudel packages', async () => {
    // Arrange
    const generatedDocumentation = await generateStrudelDocumentation()

    // Act
    const comparison = expect(generatedDocumentation)

    // Assert
    await comparison.toMatchFileSnapshot(GENERATED_DOCUMENTATION_PATH)
  })

  it.each([['s'], ['note'], ['stack'], ['lpf'], ['scale'], ['chord'], ['_pianoroll'], ['_scope']])(
    'documents %s',
    (functionName) => {
      // Arrange
      const documentedNames = strudelDocumentation.flatMap((functionDocumentation) => [
        functionDocumentation.name,
        ...functionDocumentation.synonyms
      ])

      // Act
      const isDocumented = documentedNames.includes(functionName)

      // Assert
      expect(isDocumented).toBe(true)
    }
  )
})
