type ScanState = {
  parts: string[]
  current: string
  quote: string
  escaped: boolean
  depth: number
}

type SeparatorTest = (character: string, index: number, current: string) => boolean

const QUOTES = new Set(['"', "'", '`'])
const OPENERS = new Set(['(', '[', '{'])
const CLOSERS = new Set([')', ']', '}'])
const CONTINUATION_ENDINGS = new Set([
  '.',
  ',',
  '(',
  '[',
  '{',
  '+',
  '-',
  '*',
  '/',
  '=',
  '&',
  '|',
  '?',
  ':'
])

const EMPTY_SCAN: ScanState = { parts: [], current: '', quote: '', escaped: false, depth: 0 }

const appendCharacter = (state: ScanState, character: string): ScanState => ({
  ...state,
  current: state.current + character
})

const scanQuoted = (state: ScanState, character: string): ScanState => {
  if (state.escaped) {
    return { ...appendCharacter(state, character), escaped: false }
  }
  if (character === '\\') {
    return { ...appendCharacter(state, character), escaped: true }
  }
  return {
    ...appendCharacter(state, character),
    quote: character === state.quote ? '' : state.quote
  }
}

const closePart = (state: ScanState): ScanState => {
  const part = state.current.trim()
  return { ...state, parts: part.length > 0 ? [...state.parts, part] : state.parts, current: '' }
}

const nestingChange = (character: string): number => {
  if (OPENERS.has(character)) {
    return 1
  }
  return CLOSERS.has(character) ? -1 : 0
}

const scanCharacter =
  (isSeparator: SeparatorTest) =>
  (state: ScanState, character: string, index: number): ScanState => {
    if (state.quote.length > 0) {
      return scanQuoted(state, character)
    }
    if (QUOTES.has(character)) {
      return { ...appendCharacter(state, character), quote: character }
    }
    if (state.depth === 0 && isSeparator(character, index, state.current)) {
      return closePart(state)
    }
    return {
      ...appendCharacter(state, character),
      depth: state.depth + nestingChange(character)
    }
  }

const scanTopLevel = (value: string, isSeparator: SeparatorTest): string[] =>
  closePart([...value].reduce(scanCharacter(isSeparator), EMPTY_SCAN)).parts

/**
 * Splits code at a separator that sits outside every string, bracket and call.
 * @param value - the code to split
 * @param separator - the single character to split at
 * @returns the trimmed, non-empty parts in order
 */
export const splitTopLevel = (value: string, separator: string): string[] =>
  scanTopLevel(value, (character) => character === separator)

// Walks the line once with the same quote tracking, stopping at the first `//` outside a string.
const findCommentFreePrefix = (line: string): string => {
  const characters = [...line]
  const end = characters.reduce(
    (state, character, index) => {
      if (state.end !== -1) {
        return state
      }
      if (state.quote.length > 0) {
        const closes = !state.escaped && character === state.quote
        return {
          ...state,
          quote: closes ? '' : state.quote,
          escaped: !state.escaped && character === '\\'
        }
      }
      if (QUOTES.has(character)) {
        return { ...state, quote: character }
      }
      return character === '/' && characters[index + 1] === '/' ? { ...state, end: index } : state
    },
    { quote: '', escaped: false, end: -1 }
  ).end
  return (end === -1 ? line : line.slice(0, end)).trimEnd()
}

/**
 * Removes `//` line comments while leaving `//` inside strings, such as sample URLs, alone.
 * @param code - the code to clean
 * @returns the code without line comments
 */
export const stripLineComments = (code: string): string =>
  code.split('\n').map(findCommentFreePrefix).join('\n')

/**
 * Splits a program into top-level statements: at a `;`, or at a line break that does not
 * continue the expression, as a chain does when its next line starts with `.`.
 * @param code - the program, without comments
 * @returns the statements in order
 */
export const splitStatements = (code: string): string[] =>
  scanTopLevel(code, (character, index, current) => {
    if (character === ';') {
      return true
    }
    if (character !== '\n') {
      return false
    }
    const trimmed = current.trim()
    return (
      trimmed.length > 0 &&
      !code
        .slice(index + 1)
        .trimStart()
        .startsWith('.') &&
      !CONTINUATION_ENDINGS.has(trimmed.at(-1) ?? '')
    )
  })

/**
 * Whether code parses as JavaScript, the same check Strudel's evaluation starts with. The code
 * is compiled into an async function body, so top-level `await` passes, and never run.
 * @param code - the program
 * @returns true when it has no syntax error
 */
export const isStrudelCodeSyntaxValid = (code: string): boolean => {
  try {
    // Constructing the function only parses the body; nothing in it is executed.
    const parsedProgram = new Function(`return async () => {\n${code}\n}`)
    return typeof parsedProgram === 'function'
  } catch {
    return false
  }
}

/**
 * Whether one pair of parentheses encloses the whole expression, as in `(a + b)` but not in
 * `(a)(b)`, so it can be unwrapped safely.
 * @param expression - the trimmed expression
 * @returns true when the first parenthesis closes on the last character
 */
export const isWrappedInParentheses = (expression: string): boolean => {
  if (!expression.startsWith('(') || !expression.endsWith(')')) {
    return false
  }
  const lastIndex = expression.length - 1
  const closesEarly = [...expression].reduce(
    (state, character, index) => {
      if (state.closesEarly) {
        return state
      }
      if (state.quote.length > 0) {
        const closes = !state.escaped && character === state.quote
        return {
          ...state,
          quote: closes ? '' : state.quote,
          escaped: !state.escaped && character === '\\'
        }
      }
      if (QUOTES.has(character)) {
        return { ...state, quote: character }
      }
      const depth = state.depth + nestingChange(character)
      return { ...state, depth, closesEarly: depth === 0 && index < lastIndex }
    },
    { quote: '', escaped: false, depth: 0, closesEarly: false }
  ).closesEarly
  return !closesEarly
}
