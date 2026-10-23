import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource
} from '@codemirror/autocomplete'
import type { EditorState } from '@codemirror/state'
import {
  STRUDEL_COMPLETION_PARSE_TIMEOUT_MS,
  STRUDEL_COMPLETION_PITCH_NAMES,
  STRUDEL_COMPLETION_CALLEE_LOOKBEHIND
} from '../config'
import type { StrudelCompletionVocabulary, StrudelFunctionDocumentation } from '../types'

// @lezer/common is not a direct dependency, so its node type is read off CodeMirror's.
type SyntaxNode = ReturnType<ReturnType<typeof syntaxTree>['resolveInner']>

type StringArgument = {
  callee: string
  contentFrom: number
}

const STRING_NODE_NAMES = new Set(['String', 'TemplateString'])
const COMMENT_NODE_NAMES = new Set(['LineComment', 'BlockComment'])
const VALUE_CALLEE = /(?:^|[^\w$])(s|sound|bank|chord|scale)\(\s*$/
const MINI_NOTATION_TOKEN = /[^\s!"'()*,/<>?@[\]`{|}~]*$/
const SOUND_TOKEN = /[\w-]*$/
const CHORD_ROOT = /^([A-G][#b]?)(.*)$/
const IDENTIFIER_BEFORE_CURSOR = /[\w$]*/
const IDENTIFIER_CHARACTERS = /^[\w$]*$/

const createElement = (tagName: string, className: string, text = ''): HTMLElement => {
  const element = document.createElement(tagName)
  element.className = className
  element.textContent = text
  return element
}

const renderFunctionDocumentation = (
  functionDocumentation: StrudelFunctionDocumentation,
  label: string
): HTMLElement => {
  const container = createElement('div', 'cm-strudel-doc')
  const otherNames = [functionDocumentation.name, ...functionDocumentation.synonyms].filter(
    (name) => name !== label
  )
  const parameterNames = functionDocumentation.params.map((parameter) => parameter.name).join(', ')
  container.append(
    createElement('strong', 'cm-strudel-doc__signature', `${label}(${parameterNames})`)
  )
  if (otherNames.length > 0) {
    container.append(
      createElement('p', 'cm-strudel-doc__synonyms', `Also: ${otherNames.join(', ')}`)
    )
  }
  functionDocumentation.description
    .split('\n\n')
    .forEach((paragraph) => container.append(createElement('p', 'cm-strudel-doc__text', paragraph)))
  if (functionDocumentation.params.length > 0) {
    const parameterList = createElement('ul', 'cm-strudel-doc__params')
    functionDocumentation.params.forEach((parameter) => {
      const parameterItem = createElement('li', 'cm-strudel-doc__param')
      parameterItem.append(
        createElement('code', 'cm-strudel-doc__param-name', parameter.name),
        ` ${[parameter.type, parameter.description].filter((part) => part.length > 0).join(': ')}`
      )
      parameterList.append(parameterItem)
    })
    container.append(parameterList)
  }
  const [firstExample] = functionDocumentation.examples
  if (firstExample !== undefined) {
    container.append(createElement('pre', 'cm-strudel-doc__example', firstExample))
  }
  return container
}

const toFunctionCompletions = (
  functionDocumentations: StrudelFunctionDocumentation[]
): Completion[] =>
  functionDocumentations
    .flatMap((functionDocumentation) =>
      [functionDocumentation.name, ...functionDocumentation.synonyms].map(
        (label): Completion => ({
          label,
          type: 'function',
          detail:
            functionDocumentation.params.length > 0
              ? `(${functionDocumentation.params.map((parameter) => parameter.name).join(', ')})`
              : undefined,
          info: () => renderFunctionDocumentation(functionDocumentation, label)
        })
      )
    )
    .filter(
      (completion, index, completions) =>
        completions.findIndex((candidate) => candidate.label === completion.label) === index
    )
    .sort((first, second) => first.label.localeCompare(second.label, 'en'))

const toPitchCompletions = (): Completion[] =>
  STRUDEL_COMPLETION_PITCH_NAMES.map((pitchName) => ({ label: pitchName, type: 'constant' }))

const toBankNames = (soundNames: string[]): string[] => [
  ...new Set(
    soundNames
      .filter((soundName) => soundName.includes('_'))
      .map((soundName) => soundName.slice(0, soundName.indexOf('_')))
  )
]

const resolveSyntaxNode = (state: EditorState, position: number): SyntaxNode =>
  (
    ensureSyntaxTree(state, position, STRUDEL_COMPLETION_PARSE_TIMEOUT_MS) ?? syntaxTree(state)
  ).resolveInner(position, -1)

const findEnclosing = (node: SyntaxNode, names: Set<string>): SyntaxNode | null => {
  if (names.has(node.name)) {
    return node
  }
  return node.parent === null ? null : findEnclosing(node.parent, names)
}

/**
 * The call a string is the first argument of, when it is one of the calls whose string holds
 * names (sounds, banks, chords, scales) rather than mini-notation rhythm.
 * @param state - the editor state
 * @param stringNode - the string the cursor is in
 * @returns the callee and where the string's content starts, or null for any other string
 */
const readStringArgument = (state: EditorState, stringNode: SyntaxNode): StringArgument | null => {
  const textBefore = state.sliceDoc(
    Math.max(0, stringNode.from - STRUDEL_COMPLETION_CALLEE_LOOKBEHIND),
    stringNode.from
  )
  const calleeMatch = VALUE_CALLEE.exec(textBefore)
  return calleeMatch ? { callee: calleeMatch[1] ?? '', contentFrom: stringNode.from + 1 } : null
}

const completeSound = async (
  vocabulary: StrudelCompletionVocabulary,
  typedText: string,
  position: number
): Promise<CompletionResult | null> => {
  const fragment = SOUND_TOKEN.exec(typedText)?.[0] ?? ''
  if (typedText.slice(0, typedText.length - fragment.length).endsWith(':')) {
    return null
  }
  const soundNames = await vocabulary.listSoundNames()
  return {
    from: position - fragment.length,
    options: soundNames.map((soundName) => ({ label: soundName, type: 'constant' })),
    validFor: /^[\w-]*$/
  }
}

const completeBank = async (
  vocabulary: StrudelCompletionVocabulary,
  typedText: string,
  position: number
): Promise<CompletionResult> => {
  const fragment = SOUND_TOKEN.exec(typedText)?.[0] ?? ''
  const bankNames = toBankNames(await vocabulary.listSoundNames())
  return {
    from: position - fragment.length,
    options: bankNames.map((bankName) => ({ label: bankName, type: 'constant' }))
  }
}

const completeChord = (
  vocabulary: StrudelCompletionVocabulary,
  token: string,
  position: number
): CompletionResult => {
  const rootMatch = CHORD_ROOT.exec(token)
  if (!rootMatch) {
    return { from: position - token.length, options: toPitchCompletions() }
  }
  const symbolFragment = rootMatch[2] ?? ''
  return {
    from: position - symbolFragment.length,
    // A bare root is a major triad in Strudel, so "major" writes nothing after it.
    options: vocabulary.chordSymbols.map((chordSymbol) =>
      chordSymbol === ''
        ? { label: 'major', apply: '', type: 'constant' }
        : { label: chordSymbol, type: 'constant' }
    )
  }
}

const completeScale = (
  vocabulary: StrudelCompletionVocabulary,
  token: string,
  position: number
): CompletionResult => {
  const colonIndex = token.lastIndexOf(':')
  if (colonIndex === -1) {
    return { from: position - token.length, options: toPitchCompletions() }
  }
  const nameFragment = token.slice(colonIndex + 1)
  return {
    from: position - nameFragment.length,
    // Strudel splits a scale on spaces, so a multi-word name is written with colons.
    options: vocabulary.scaleNames.map((scaleName) => ({
      label: scaleName,
      apply: scaleName.replaceAll(' ', ':'),
      type: 'constant'
    }))
  }
}

const completeStringArgument = (
  vocabulary: StrudelCompletionVocabulary,
  context: CompletionContext,
  stringArgument: StringArgument
): Promise<CompletionResult | null> | CompletionResult => {
  const typedText = context.state.sliceDoc(stringArgument.contentFrom, context.pos)
  const token = MINI_NOTATION_TOKEN.exec(typedText)?.[0] ?? ''
  if (stringArgument.callee === 'bank') {
    return completeBank(vocabulary, typedText, context.pos)
  }
  if (stringArgument.callee === 'chord') {
    return completeChord(vocabulary, token, context.pos)
  }
  if (stringArgument.callee === 'scale') {
    return completeScale(vocabulary, token, context.pos)
  }
  return completeSound(vocabulary, typedText, context.pos)
}

const completeFunction = (
  functionCompletions: Completion[],
  context: CompletionContext
): CompletionResult | null => {
  const word = context.matchBefore(IDENTIFIER_BEFORE_CURSOR)
  if (word === null) {
    return null
  }
  const isAfterDot = context.state.sliceDoc(word.from - 1, word.from) === '.'
  if (word.from === word.to && !context.explicit && !isAfterDot) {
    return null
  }
  return { from: word.from, options: functionCompletions, validFor: IDENTIFIER_CHARACTERS }
}

/**
 * Completes Strudel code the way strudel.cc does: functions and their synonyms with their
 * documentation, sound and bank names inside `s()` and `bank()`, chord symbols inside `chord()`
 * and scale names inside `scale()`. Comments and mini-notation rhythms are left alone.
 * @param vocabulary - the documented functions and the names to offer inside strings
 * @returns a CodeMirror completion source
 */
export const createStrudelCompletionSource = (
  vocabulary: StrudelCompletionVocabulary
): CompletionSource => {
  const functionCompletions = toFunctionCompletions(vocabulary.functionDocumentations)
  return (context) => {
    const node = resolveSyntaxNode(context.state, context.pos)
    if (findEnclosing(node, COMMENT_NODE_NAMES) !== null) {
      return null
    }
    const stringNode = findEnclosing(node, STRING_NODE_NAMES)
    if (stringNode !== null) {
      const stringArgument = readStringArgument(context.state, stringNode)
      return stringArgument === null
        ? null
        : completeStringArgument(vocabulary, context, stringArgument)
    }
    return completeFunction(functionCompletions, context)
  }
}
