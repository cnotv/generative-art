import {
  parse,
  compileScript,
  compileTemplate,
  compileStyle,
  type SFCDescriptor
} from 'vue/compiler-sfc'
import type { CompiledComponent } from './types'

type CompileErrors = readonly (Error | string)[]

const COMPONENT_NAME = '__component'

const formatErrors = (errors: CompileErrors): string =>
  errors.map((error) => (typeof error === 'string' ? error : error.message)).join('\n')

const hasUnsupportedScriptLanguage = (descriptor: SFCDescriptor): boolean =>
  [descriptor.script?.lang, descriptor.scriptSetup?.lang].some(
    (language) => language !== undefined && language !== 'js'
  )

const compileScriptBlock = (descriptor: SFCDescriptor, componentId: string): string =>
  descriptor.script || descriptor.scriptSetup
    ? compileScript(descriptor, {
        id: componentId,
        inlineTemplate: true,
        genDefaultAs: COMPONENT_NAME
      }).content
    : `const ${COMPONENT_NAME} = {}`

// `<script setup>` inlines its template; a plain `<script>` or no script needs a separate
// render function attached to the component object.
const compileSeparateTemplate = (
  descriptor: SFCDescriptor,
  componentId: string,
  isScoped: boolean
): { code: string; errors: CompileErrors } => {
  if (descriptor.scriptSetup || !descriptor.template) return { code: '', errors: [] }
  const result = compileTemplate({
    source: descriptor.template.content,
    filename: descriptor.filename,
    id: componentId,
    scoped: isScoped,
    compilerOptions: { scopeId: isScoped ? `data-v-${componentId}` : undefined }
  })
  return {
    code: `${result.code.replace(/export function render/, 'function render')}\n${COMPONENT_NAME}.render = render`,
    errors: result.errors
  }
}

const compileStyles = (
  descriptor: SFCDescriptor,
  componentId: string
): { css: string; errors: CompileErrors } => {
  const results = descriptor.styles.map((style) =>
    compileStyle({
      source: style.content,
      filename: descriptor.filename,
      id: `data-v-${componentId}`,
      scoped: style.scoped
    })
  )
  return {
    css: results.map((result) => result.code).join('\n'),
    errors: results.flatMap((result) => result.errors)
  }
}

const compileDescriptor = (descriptor: SFCDescriptor, componentId: string): CompiledComponent => {
  const isScoped = descriptor.styles.some((style) => style.scoped)
  const scriptCode = compileScriptBlock(descriptor, componentId)
  const template = compileSeparateTemplate(descriptor, componentId, isScoped)
  const styles = compileStyles(descriptor, componentId)
  const errors = [...template.errors, ...styles.errors]
  if (errors.length > 0) return { ok: false, error: formatErrors(errors) }
  const scopeIdLine = isScoped ? `${COMPONENT_NAME}.__scopeId = 'data-v-${componentId}'` : ''
  return {
    ok: true,
    code: [scriptCode, template.code, scopeIdLine, `export default ${COMPONENT_NAME}`].join('\n'),
    css: styles.css
  }
}

/**
 * Compiles a Vue single file component into an ES module that imports from `vue`, plus its
 * CSS. Compiling only parses the source, so it runs in the host; the result runs in the frame.
 * Only JavaScript is supported in the script blocks.
 * @param source - The single file component source.
 * @param componentId - A short id used to scope the component's styles.
 * @returns The module code and CSS, or the compile error.
 */
export const compileComponent = (source: string, componentId: string): CompiledComponent => {
  const { descriptor, errors } = parse(source, { filename: `${componentId}.vue` })
  if (errors.length > 0) return { ok: false, error: formatErrors(errors) }
  if (!descriptor.template && !descriptor.script && !descriptor.scriptSetup) {
    return { ok: false, error: 'The component has no template and no script.' }
  }
  if (hasUnsupportedScriptLanguage(descriptor)) {
    return { ok: false, error: 'Only JavaScript is supported in the script blocks.' }
  }
  try {
    return compileDescriptor(descriptor, componentId)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
