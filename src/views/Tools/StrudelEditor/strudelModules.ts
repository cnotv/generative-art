import type { StrudelUnknownCallable } from './types'

/**
 * Whether a value is an object Strudel functions can be read off.
 * @param moduleValue - a module, or anything read from one
 * @returns true for any non-null object
 */
export const isRecordModule = (moduleValue: unknown): moduleValue is Record<string, unknown> =>
  typeof moduleValue === 'object' && moduleValue !== null

/**
 * A value as a function, when it is one.
 * @param callableValue - something read from a Strudel module
 * @returns the function, or undefined when it is not one
 */
export const toCallable = (callableValue: unknown): StrudelUnknownCallable | undefined =>
  // Strudel ships untyped JS, so the shape is checked before calling.
  typeof callableValue === 'function' ? (callableValue as StrudelUnknownCallable) : undefined

/**
 * A value as a function, or an error naming the failure when a Strudel export is missing.
 * @param callableValue - something read from a Strudel module
 * @returns the function
 */
export const requireCallable = (callableValue: unknown): StrudelUnknownCallable => {
  const callable = toCallable(callableValue)
  if (callable === undefined) {
    throw new Error('Strudel modules failed to load')
  }
  return callable
}

/**
 * A Strudel module's exports, or an error naming the failure when the import is not one.
 * @param moduleValue - what a dynamic import resolved to
 * @returns the module as a record to read functions off
 */
export const requireRecordModule = (moduleValue: unknown): Record<string, unknown> => {
  if (!isRecordModule(moduleValue)) {
    throw new Error('Strudel modules failed to load')
  }
  return moduleValue
}
