import type { StrudelCodeFacts, StrudelHint } from '../types'
import { readStrudelCodeFacts } from './readStrudelCodeFacts'

const insertAt = (code: string, position: number, text: string): string =>
  `${code.slice(0, position)}${text}${code.slice(position)}`

const applyTempo = (code: string, facts: StrudelCodeFacts, snippet: string): string => {
  if (facts.tempo !== null) {
    const { from, to } = facts.tempo.statement
    return `${code.slice(0, from)}${snippet}${code.slice(to)}`
  }
  return facts.headerEnd > 0
    ? insertAt(code, facts.headerEnd, `\n${snippet}`)
    : insertAt(code, 0, `${snippet}\n`)
}

// Once any `$:` block exists Strudel plays only the blocks, so a plain pattern becomes a block
// before the new layer is added as another one.
const applyInstrument = (code: string, facts: StrudelCodeFacts, snippet: string): string => {
  const lastPattern = facts.patternStatements.at(-1)
  const blockCode =
    facts.usesPatternBlocks || lastPattern === undefined
      ? code
      : insertAt(code, lastPattern.from, '$: ')
  const trimmedCode = blockCode.trimEnd()
  return trimmedCode.length === 0 ? `$: ${snippet}` : `${trimmedCode}\n$: ${snippet}`
}

const applyVisual = (code: string, facts: StrudelCodeFacts, snippet: string): string => {
  const lastPattern = facts.patternStatements.at(-1)
  return lastPattern === undefined ? code : insertAt(code, lastPattern.to, snippet)
}

/**
 * Writes a hint's snippet into the code: a tempo replaces the one set or goes under the
 * header comments, an instrument becomes a new `$:` block, and a visual is chained onto the
 * last pattern.
 * @param code - the pattern's code
 * @param hint - the hint to apply
 * @returns the code with the hint applied
 */
export const applyStrudelHint = (code: string, hint: StrudelHint): string => {
  const facts = readStrudelCodeFacts(code)
  if (hint.kind === 'tempo') {
    return applyTempo(code, facts, hint.snippet)
  }
  if (hint.kind === 'instrument') {
    return applyInstrument(code, facts, hint.snippet)
  }
  return applyVisual(code, facts, hint.snippet)
}
