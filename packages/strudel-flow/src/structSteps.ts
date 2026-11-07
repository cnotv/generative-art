import { STRUDEL_FLOW_STEP_COUNT } from './config'

const STEPS_PATTERN = /^"\s*([x~](?:\s+[x~])*)\s*"$/

/**
 * Reads a plain struct pattern, hits as `x` and rests as `~`, into one switch per step.
 * @param argument - the call's argument as written
 * @returns the switches, or null for anything richer, such as `"x(3,8)"` or a named constant
 */
export const readStrudelFlowStructSteps = (argument: string): boolean[] | null => {
  const steps = STEPS_PATTERN.exec(argument.trim())?.[1].split(/\s+/)
  return steps === undefined || steps.length > STRUDEL_FLOW_STEP_COUNT
    ? null
    : steps.map((step) => step === 'x')
}

/**
 * Writes switches back as a struct argument.
 * @param steps - one switch per step, on for a hit
 * @returns the argument, such as `"x ~ x x"`
 */
export const writeStrudelFlowStructSteps = (steps: boolean[]): string =>
  `"${steps.map((step) => (step ? 'x' : '~')).join(' ')}"`
