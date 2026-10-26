import { getStrudelFlowChordNotes } from './chords'
import type {
  StrudelFlowBeatsData,
  StrudelFlowChordsData,
  StrudelFlowDrumRow,
  StrudelFlowNodeData,
  StrudelFlowPadData
} from './types'

const MINI_NOTATION_HIT = '1'
const MINI_NOTATION_REST = '~'

/**
 * Rounds a control value to the two decimals a Strudel call reads cleanly as.
 * @param value - the control value
 * @returns the rounded number, or zero when the value is not finite
 */
export const formatStrudelFlowNumber = (value: number): number =>
  Number.isFinite(value) ? Math.round(value * 100) / 100 : 0

const padStep = (
  row: boolean[] | undefined,
  stepIndex: number,
  data: StrudelFlowPadData
): string => {
  const notes = (row ?? [])
    .map((isOn, noteIndex) => (isOn ? String(noteIndex) : null))
    .filter((note): note is string => note !== null)
  const modifier = data.columnModifiers[stepIndex] ?? ''
  if (notes.length === 0) {
    return `[~]${modifier}`
  }
  return `[${notes.join(data.mode === 'arp' ? ' ' : ', ')}]${modifier}`
}

const generatePadPattern = (data: StrudelFlowPadData): string => {
  const steps = Math.max(1, Math.min(data.steps, data.grid.length))
  const stepPatterns = data.grid
    .slice(0, steps)
    .map((row, stepIndex) => padStep(row, stepIndex, data))
  if (stepPatterns.every((step) => step.startsWith('[~]'))) {
    return ''
  }
  const scale = `${data.key}${data.octave}:${data.scaleType}`
  return `n(${JSON.stringify(stepPatterns.join(' '))}).scale(${JSON.stringify(scale)}).sound(${JSON.stringify(
    data.sound
  )})`
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

const generateChordsPattern = (data: StrudelFlowChordsData): string => {
  const chords = getStrudelFlowChordNotes(data)
  if (chords.every((chord) => chord.length === 0)) {
    return ''
  }
  const chordPatterns = chords.map((chord) => (chord.length > 0 ? `[${chord.join(',')}]` : '~'))
  const scale = `${data.key}${data.octave}:${data.scaleType}`
  return `n(${JSON.stringify(`<${chordPatterns.join(' ')}>`)}).scale(${JSON.stringify(scale)}).sound(${JSON.stringify(
    data.sound
  )})`
}

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
      )}).roomfade(${formatStrudelFlowNumber(data.roomFade)}).roomlp(${formatStrudelFlowNumber(
        data.roomLowPass
      )}).roomdim(${formatStrudelFlowNumber(data.roomDim)})`

const generateLevelPattern = (
  data: Extract<StrudelFlowNodeData, { kind: 'level' }>,
  input: string
): string =>
  input.length === 0
    ? ''
    : `${input}.gain(${formatStrudelFlowNumber(data.gain)}).pan(${formatStrudelFlowNumber(
        data.pan
      )}).postgain(${formatStrudelFlowNumber(data.postgain)})`

const generateEnvelopePattern = (
  data: Extract<StrudelFlowNodeData, { kind: 'envelope' }>,
  input: string
): string =>
  input.length === 0
    ? ''
    : `${input}.attack(${formatStrudelFlowNumber(data.attack)}).decay(${formatStrudelFlowNumber(
        data.decay
      )}).sustain(${formatStrudelFlowNumber(data.sustain)}).release(${formatStrudelFlowNumber(
        data.release
      )})`

const generateScopePattern = (
  _data: Extract<StrudelFlowNodeData, { kind: 'scope' }>,
  input: string
): string => (input.length === 0 ? '' : `${input}.analyze("flow-scope")`)

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
  // The switch is one branch per node kind; splitting it would only hide that shape.
  // eslint-disable-next-line complexity
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
    case 'level':
      return generateLevelPattern(data, input)
    case 'envelope':
      return generateEnvelopePattern(data, input)
    case 'scope':
      return generateScopePattern(data, input)
    default:
      throw new Error('Unsupported node kind')
  }
}
