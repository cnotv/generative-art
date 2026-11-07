import { isStringLiteral, readStringLiteral, splitMiniNotation, splitTopLevel } from './codeScanner'

const DECLARATION_PATTERN = /^(?:const|let|var)\s+([$A-Z_a-z][\w$]*)\s*=\s*([\S\s]+?);?\s*$/
const IDENTIFIER_PATTERN = /^[$A-Z_a-z][\w$]*$/
const ARRANGE_PATTERN = /^arrange\s*\(([\S\s]*)\)$/
const SECTION_PATTERN = /^\[([\S\s]*)]$/
const REPEAT_PATTERN = /^([\S\s]+)!(\d+)$/
// A head called on its own, never as a method: `.chord(x)` voices a pattern rather than being one.
const VARIABLE_HEAD_PATTERN = /(?<![\w$.])(note|chord)\(\s*([$A-Z_a-z][\w$]*)\s*\)/g
const SILENCE = 'silence'
const REST = '~'
const MAX_DEPTH = 8
// An arrangement whose sections only line up again after more passes than this stays as code.
const MAX_PASSES = 8

const isWhitespace = (character: string): boolean => /\s/.test(character)

const greatestCommonDivisor = (first: number, second: number): number =>
  second === 0 ? first : greatestCommonDivisor(second, first % second)

const leastCommonMultiple = (first: number, second: number): number =>
  (first * second) / greatestCommonDivisor(first, second)

// A step whose timing reaches past its own cycle, or that alternates on its own, would play
// differently once moved into another slot of a longer alternation.
const isSelfContainedBar = (bar: string): boolean =>
  !bar.includes('<') &&
  !bar.includes('/') &&
  bar !== '_' &&
  splitMiniNotation(bar, (character) => character === '@').length <= 1

const asBar = (pattern: string): string =>
  splitMiniNotation(pattern, isWhitespace).length > 1 ||
  splitMiniNotation(pattern, (character) => character === ',').length > 1
    ? `[${pattern}]`
    : pattern

const expandRepeat = (item: string): string[] => {
  const repeat = REPEAT_PATTERN.exec(item)
  return repeat === null ? [item] : Array.from({ length: Number(repeat[2]) }, () => repeat[1])
}

const isAlternation = (pattern: string): boolean =>
  pattern.startsWith('<') &&
  pattern.endsWith('>') &&
  splitMiniNotation(pattern, isWhitespace).length === 1 &&
  splitMiniNotation(pattern, (character) => character === ',').length === 1

// One cycle per entry, for as many cycles as the pattern takes to repeat.
const readBars = (pattern: string): string[] | null => {
  const bars = isAlternation(pattern)
    ? splitMiniNotation(pattern.slice(1, -1), isWhitespace).flatMap(expandRepeat)
    : [asBar(pattern)]
  return bars.length > 0 && bars.every(isSelfContainedBar) ? bars : null
}

const writeBars = (bars: string[]): string =>
  `<${bars
    .reduce<{ bar: string; count: number }[]>((runs, bar) => {
      const last = runs.at(-1)
      return last?.bar === bar
        ? [...runs.slice(0, -1), { bar, count: last.count + 1 }]
        : [...runs, { bar, count: 1 }]
    }, [])
    .map(({ bar, count }) => (count > 1 ? `${bar}!${count}` : bar))
    .join(' ')}>`

type Section = { cycles: number; bars: string[] }

const readSection = (
  text: string,
  variables: Map<string, string>,
  depth: number
): Section | null => {
  const inner = SECTION_PATTERN.exec(text.trim())?.[1]
  const [cyclesText, value, ...rest] = inner === undefined ? [] : splitTopLevel(inner, ',')
  const cycles = Number(cyclesText)
  if (value === undefined || rest.length > 0 || !Number.isInteger(cycles) || cycles < 1) {
    return null
  }
  const pattern = resolveMiniNotation(value, variables, depth + 1)
  const bars = pattern === null ? null : readBars(pattern)
  return bars === null ? null : { cycles, bars }
}

// `arrange` plays each section for its cycles, and a section picks up on the next pass where it
// stopped, so the unrolled bars run until every section is back at its own start.
const resolveArrange = (
  argument: string,
  variables: Map<string, string>,
  depth: number
): string | null => {
  const sections = splitTopLevel(argument, ',').map((text) => readSection(text, variables, depth))
  if (sections.length === 0 || sections.some((section) => section === null)) {
    return null
  }
  const readSections = sections.filter((section): section is Section => section !== null)
  const passes = readSections.reduce(
    (result, { cycles, bars }) =>
      leastCommonMultiple(result, bars.length / greatestCommonDivisor(cycles, bars.length)),
    1
  )
  if (passes > MAX_PASSES) {
    return null
  }
  return writeBars(
    Array.from({ length: passes }, (_, pass) => pass).flatMap((pass) =>
      readSections.flatMap(({ cycles, bars }) =>
        Array.from(
          { length: cycles },
          (_, cycle) => bars[(pass * cycles + cycle) % bars.length] ?? REST
        )
      )
    )
  )
}

const resolveMiniNotation = (
  value: string,
  variables: Map<string, string>,
  depth: number
): string | null => {
  const trimmed = value.trim()
  if (depth > MAX_DEPTH) {
    return null
  }
  if (trimmed === SILENCE) {
    return REST
  }
  if (isStringLiteral(trimmed)) {
    return readStringLiteral(trimmed)
  }
  const declared = IDENTIFIER_PATTERN.test(trimmed) ? variables.get(trimmed) : undefined
  if (declared !== undefined) {
    return resolveMiniNotation(declared, variables, depth + 1)
  }
  const arrangement = ARRANGE_PATTERN.exec(trimmed)?.[1]
  return arrangement === undefined ? null : resolveArrange(arrangement, variables, depth)
}

/**
 * Reads the constants a program declares, by name, so a pattern that plays one can be read.
 * @param statements - the program's setup statements
 * @returns each declared name with the code of its value
 */
export const readStrudelFlowVariables = (statements: string[]): Map<string, string> =>
  new Map(
    statements.flatMap((statement): [string, string][] => {
      const declaration = DECLARATION_PATTERN.exec(statement.trim())
      return declaration === null ? [] : [[declaration[1], declaration[2].trim()]]
    })
  )

/**
 * Writes the mini notation a constant holds in place of its name in `note(name)` and
 * `chord(name)`, so the line reads as a Notes node. A string, `silence`, another constant or an
 * `arrange(...)` of those is inlined; anything else, such as a function of the song's own, stays
 * as written.
 * @param expression - one pattern expression
 * @param variables - the program's constants, from `readStrudelFlowVariables`
 * @returns the expression with every readable constant inlined
 */
export const inlineStrudelFlowPatternVariables = (
  expression: string,
  variables: Map<string, string>
): string =>
  expression.replace(VARIABLE_HEAD_PATTERN, (call, head: string, name: string) => {
    const pattern = resolveMiniNotation(name, variables, 0)
    return pattern === null ? call : `${head}(${JSON.stringify(pattern)})`
  })
