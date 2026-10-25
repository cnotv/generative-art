import type { StrudelFlowBeatsData, StrudelFlowDrumRow, StrudelFlowNodeData } from './types'

const MINI_NOTATION_HIT = '1'
const MINI_NOTATION_REST = '~'

/**
 * Rounds a control value to the two decimals a Strudel call reads cleanly as.
 * @param value - the control value
 * @returns the rounded number, or zero when the value is not finite
 */
export const formatStrudelFlowNumber = (value: number): number =>
  Number.isFinite(value) ? Math.round(value * 100) / 100 : 0

const generatePadPattern = (data: Extract<StrudelFlowNodeData, { kind: 'pad' }>): string => {
  const notes = data.notes.trim()
  if (notes.length === 0) {
    return ''
  }
  return `note(${JSON.stringify(notes)}).sound(${JSON.stringify(data.sound)})`
}

const generateDrumRowPattern = (row: StrudelFlowDrumRow): string => {
  if (!row.steps.some((step) => step)) {
    return ''
  }
  const steps = row.steps.map((step) => (step ? MINI_NOTATION_HIT : MINI_NOTATION_REST)).join(' ')
  return `s(${JSON.stringify(row.instrument)}).struct(${JSON.stringify(steps)})`
}

const generateBeatsPattern = (data: StrudelFlowBeatsData): string => {
  const rowPatterns = data.rows.map(generateDrumRowPattern).filter((pattern) => pattern.length > 0)
  if (rowPatterns.length === 0) {
    return ''
  }
  return rowPatterns.length === 1 ? rowPatterns[0] : `stack(${rowPatterns.join(', ')})`
}

const generateChordsPattern = (data: Extract<StrudelFlowNodeData, { kind: 'chords' }>): string =>
  `chord(${JSON.stringify(`<${data.root}${data.chordType}>`)}).voicing().sound(${JSON.stringify(data.sound)})`

const generateCodePattern = (data: Extract<StrudelFlowNodeData, { kind: 'code' }>): string => {
  const expression = data.code.trim().replace(/;+\s*$/, '')
  return expression.length === 0 ? '' : `(\n${expression}\n)`
}

const generateFilterPattern = (
  data: Extract<StrudelFlowNodeData, { kind: 'filter' }>,
  input: string
): string =>
  input.length === 0
    ? ''
    : `${input}.lpf(${formatStrudelFlowNumber(data.cutoff)}).lpq(${formatStrudelFlowNumber(
        data.resonance
      )})`

const generateDelayPattern = (
  data: Extract<StrudelFlowNodeData, { kind: 'delay' }>,
  input: string
): string =>
  input.length === 0
    ? ''
    : `${input}.delay(${formatStrudelFlowNumber(data.mix)}).delaytime(${formatStrudelFlowNumber(
        data.time
      )}).delayfeedback(${formatStrudelFlowNumber(data.feedback)})`

const generateSpacePattern = (
  data: Extract<StrudelFlowNodeData, { kind: 'space' }>,
  input: string
): string =>
  input.length === 0
    ? ''
    : `${input}.room(${formatStrudelFlowNumber(data.room)}).roomsize(${formatStrudelFlowNumber(
        data.roomSize
      )})`

/**
 * The Strudel expression a node contributes, with its input already chained in.
 * Instruments ignore the input and start a pattern; effects return it untouched when there is
 * nothing to transform, so an unconnected effect cannot emit code of its own.
 * @param data - the node's settings
 * @param input - the pattern arriving from upstream, empty for an instrument
 * @returns the node's Strudel expression, or an empty string when it makes no sound
 */
export const generateStrudelFlowNodePattern = (
  data: StrudelFlowNodeData,
  input: string
): string => {
  switch (data.kind) {
    case 'pad':
      return generatePadPattern(data)
    case 'beats':
      return generateBeatsPattern(data)
    case 'chords':
      return generateChordsPattern(data)
    case 'code':
      return generateCodePattern(data)
    case 'filter':
      return generateFilterPattern(data, input)
    case 'delay':
      return generateDelayPattern(data, input)
    case 'space':
      return generateSpacePattern(data, input)
    default:
      throw new Error('Unsupported node kind')
  }
}
