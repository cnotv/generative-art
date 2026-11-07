import { splitTopLevel } from './codeScanner'
import { STRUDEL_FLOW_CALL_PARAMETERS } from './config'
import { formatStrudelFlowNumber } from './nodePatterns'
import type { StrudelFlowCall, StrudelFlowCallField, StrudelFlowCallParameter } from './types'

const NUMBER_PATTERN = /^-?(\d+\.?\d*|\.\d+)(\/(\d+\.?\d*|\.\d+))?$/
const TOGGLES_PATTERN = /^(["'])(<?)\s*([01](?:!\d+)?(?:\s+[01](?:!\d+)?)*)\s*(>?)\1$/
const MAX_TOGGLE_STEPS = 64

// Accepts a decimal or a fraction such as `1/3`, the way swing amounts are usually written.
const readNumberArgument = (text: string): number | null => {
  if (!NUMBER_PATTERN.test(text)) {
    return null
  }
  const [numerator, denominator] = text.split('/').map(Number)
  const value = denominator === undefined ? numerator : numerator / denominator
  return Number.isFinite(value) ? value : null
}

const readToggles = (label: string, text: string): StrudelFlowCallField | null => {
  const match = TOGGLES_PATTERN.exec(text)
  if (match === null || (match[2] === '<') !== (match[4] === '>')) {
    return null
  }
  const steps = match[3].split(/\s+/).flatMap((token) => {
    const [value, repeats] = token.split('!')
    return Array.from({ length: Number(repeats ?? 1) }, () => value === '1')
  })
  return steps.length > MAX_TOGGLE_STEPS
    ? null
    : {
        kind: 'toggles',
        label,
        steps,
        perCycle: match[2] === '<',
        ...(match[3].includes('!') ? { repeated: true } : {})
      }
}

const readField = (
  parameter: StrudelFlowCallParameter,
  text: string
): StrudelFlowCallField | null => {
  if (parameter.kind === 'text') {
    return text.length === 0 ? null : { ...parameter, value: text }
  }
  if (parameter.kind === 'toggles') {
    return readToggles(parameter.label, text)
  }
  const value = readNumberArgument(text)
  return value === null ? null : { ...parameter, value }
}

/**
 * Reads a call's argument into the controls its node shows, such as a chance slider and the
 * function for `sometimesBy`, or a step per cycle for `mask("<1 1 1 0>")`.
 * @param call - the call as written in the code
 * @returns one field per argument, or null when the call has no controls or its argument is
 *   something they cannot show, so it stays editable as text
 */
export const readStrudelFlowCallFields = (call: StrudelFlowCall): StrudelFlowCallField[] | null => {
  const parameters = STRUDEL_FLOW_CALL_PARAMETERS[call.method.trim()]
  const argumentTexts = splitTopLevel(call.argument, ',').map((text) => text.trim())
  if (parameters === undefined || argumentTexts.length !== parameters.length) {
    return null
  }
  const fields = parameters.map((parameter, index) => readField(parameter, argumentTexts[index]))
  return fields.every((field): field is StrudelFlowCallField => field !== null) ? fields : null
}

const toBit = (step: boolean): string => (step ? '1' : '0')

// `1!40 0!8`: each run of equal steps written once with its length.
const toRuns = (steps: boolean[]): string[] =>
  steps
    .reduce<
      { step: boolean; length: number }[]
    >((runs, step) => (runs.at(-1)?.step === step ? [...runs.slice(0, -1), { step, length: (runs.at(-1)?.length ?? 0) + 1 }] : [...runs, { step, length: 1 }]), [])
    .map((run) => `${toBit(run.step)}${run.length > 1 ? `!${run.length}` : ''}`)

const writeField = (field: StrudelFlowCallField): string => {
  if (field.kind === 'number') {
    return String(formatStrudelFlowNumber(field.value))
  }
  if (field.kind === 'text') {
    return field.value
  }
  const steps = (field.repeated === true ? toRuns(field.steps) : field.steps.map(toBit)).join(' ')
  return field.perCycle ? `"<${steps}>"` : `"${steps}"`
}

/**
 * Writes controls back as a call argument.
 * @param fields - the fields `readStrudelFlowCallFields` read, with their new values
 * @returns the argument, such as `0.2, (x) => x.ply(2)`
 */
export const writeStrudelFlowCallFields = (fields: StrudelFlowCallField[]): string =>
  fields.map(writeField).join(', ')
