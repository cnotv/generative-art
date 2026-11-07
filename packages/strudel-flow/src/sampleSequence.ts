import type { StrudelFlowSampleLayer, StrudelFlowSampleStep } from './types'

type SplitState = { parts: string[]; current: string; depth: number }

const OPENERS = new Set(['[', '<', '(', '{'])
const CLOSERS = new Set([']', '>', ')', '}'])
const REST_TOKENS = new Set(['~', '-'])
const SOUND_PATTERN = /^([\dA-Za-z][\w.]*(?::\d+)?)(.*)$/
// Repeats, lengths, speeds, chance and euclidean rhythms, in any order: `*2`, `@3`, `?`, `(3,8)`.
const MODIFIER_PATTERN = /^(?:[!*/@]\d*\.?\d+|!|\?\d*\.?\d*|\(\s*\d+\s*(?:,\s*\d+\s*){1,2}\))*$/
const BRACKETS = { subdivide: ['[', ']'], alternate: ['<', '>'] } as const

const closePart = (state: SplitState): SplitState => {
  const part = state.current.trim()
  return { parts: part.length > 0 ? [...state.parts, part] : state.parts, current: '', depth: 0 }
}

// Splits mini notation at a separator outside every bracket, which the code scanner cannot do
// since `<` is a comparison in code but an alternation here.
const splitMiniNotation = (text: string, isSeparator: (character: string) => boolean): string[] =>
  closePart(
    [...text].reduce<SplitState>(
      (state, character) => {
        if (state.depth === 0 && isSeparator(character)) {
          return { ...closePart(state), depth: 0 }
        }
        const depthChange = OPENERS.has(character) ? 1 : CLOSERS.has(character) ? -1 : 0
        return {
          ...state,
          current: state.current + character,
          depth: Math.max(0, state.depth + depthChange)
        }
      },
      { parts: [], current: '', depth: 0 }
    )
  ).parts

const findClosingBracket = (token: string, closer: string): number =>
  [...token].reduce(
    (state, character, index) => {
      if (state.closedAt !== -1) {
        return state
      }
      const depth = state.depth + (OPENERS.has(character) ? 1 : CLOSERS.has(character) ? -1 : 0)
      return { depth, closedAt: depth === 0 && character === closer ? index : -1 }
    },
    { depth: 0, closedAt: -1 }
  ).closedAt

const readGroup = (token: string): StrudelFlowSampleStep | null => {
  const bracket = token.startsWith('[') ? 'subdivide' : token.startsWith('<') ? 'alternate' : null
  if (bracket === null) {
    return null
  }
  const closedAt = findClosingBracket(token, BRACKETS[bracket][1])
  const modifier = token.slice(closedAt + 1)
  if (closedAt === -1 || !MODIFIER_PATTERN.test(modifier)) {
    return null
  }
  return {
    kind: 'group',
    bracket,
    layers: parseStrudelFlowSampleLayers(token.slice(1, closedAt)),
    modifier
  }
}

const readStep = (token: string): StrudelFlowSampleStep => {
  if (REST_TOKENS.has(token)) {
    return { kind: 'rest' }
  }
  const group = readGroup(token)
  if (group !== null) {
    return group
  }
  const sound = SOUND_PATTERN.exec(token)
  return sound !== null && MODIFIER_PATTERN.test(sound[2])
    ? { kind: 'sound', sound: sound[1], modifier: sound[2] }
    : { kind: 'text', text: token }
}

/**
 * Reads a Samples line into the steps its editor shows. Whatever the editor has no control for,
 * such as a `{...}` polymeter, stays a text step, so writing the steps back never loses it.
 * @param pattern - the mini notation inside `s("...")`, such as `bd*2 [~ sd], hh*8`
 * @returns one list of steps per comma separated layer
 */
export const parseStrudelFlowSampleLayers = (pattern: string): StrudelFlowSampleLayer[] =>
  splitMiniNotation(pattern, (character) => character === ',').map((layer) =>
    splitMiniNotation(layer, (character) => /\s/.test(character)).map(readStep)
  )

const writeStep = (step: StrudelFlowSampleStep): string => {
  if (step.kind === 'rest') {
    return '~'
  }
  if (step.kind === 'text') {
    return step.text
  }
  if (step.kind === 'sound') {
    return `${step.sound}${step.modifier}`
  }
  const [opener, closer] = BRACKETS[step.bracket]
  return `${opener}${writeStrudelFlowSampleLayers(step.layers)}${closer}${step.modifier}`
}

/**
 * Writes the editor's steps back as mini notation.
 * @param layers - the steps of each layer
 * @returns the pattern, with layers joined by `, `; empty layers are left out
 */
export const writeStrudelFlowSampleLayers = (layers: StrudelFlowSampleLayer[]): string =>
  layers
    .map((layer) => layer.map(writeStep).join(' '))
    .filter((layer) => layer.length > 0)
    .join(', ')
