import { splitTopLevel } from './codeScanner'
import { STRUDEL_FLOW_CALL_PARAMETERS } from './config'
import { formatStrudelFlowNumber } from './nodePatterns'
import type { StrudelFlowCall, StrudelFlowCallField, StrudelFlowCallParameter } from './types'

const NUMBER_PATTERN = /^-?(\d+\.?\d*|\.\d+)(\/(\d+\.?\d*|\.\d+))?$/
const TOGGLES_PATTERN = /^(["'])(<?)\s*([01](?:\s+[01])*)\s*(>?)\1$/

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
  return {
    kind: 'toggles',
    label,
    steps: match[3].split(/\s+/).map((step) => step === '1'),
    perCycle: match[2] === '<'
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

const writeField = (field: StrudelFlowCallField): string => {
  if (field.kind === 'number') {
    return String(formatStrudelFlowNumber(field.value))
  }
  if (field.kind === 'text') {
    return field.value
  }
  const steps = field.steps.map((step) => (step ? '1' : '0')).join(' ')
  return field.perCycle ? `"<${steps}>"` : `"${steps}"`
}

/**
 * Writes controls back as a call argument.
 * @param fields - the fields `readStrudelFlowCallFields` read, with their new values
 * @returns the argument, such as `0.2, (x) => x.ply(2)`
 */
export const writeStrudelFlowCallFields = (fields: StrudelFlowCallField[]): string =>
  fields.map(writeField).join(', ')
