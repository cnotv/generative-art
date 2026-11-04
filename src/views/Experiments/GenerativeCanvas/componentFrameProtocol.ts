import type { CanvasState, CanvasStateValue, FrameToHostMessage } from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStateValue = (value: unknown): value is CanvasStateValue =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

const isCanvasState = (value: unknown): value is CanvasState =>
  isRecord(value) && Object.values(value).every(isStateValue)

/**
 * Narrows a message posted by the sandboxed frame to a known shape, keeping only the fields
 * the host reads. The frame runs agent-written code, so anything else is dropped.
 * @param data - The `data` of a `message` event whose source is the frame.
 * @returns The validated message, or null when the shape is unknown.
 */
export const parseFrameMessage = (data: unknown): FrameToHostMessage | null => {
  if (!isRecord(data)) return null
  if (data.type === 'ready' || data.type === 'mounted') return { type: data.type }
  if (data.type === 'error' && typeof data.message === 'string') {
    return { type: 'error', message: data.message }
  }
  if (data.type === 'update' && isCanvasState(data.patch)) {
    return { type: 'update', patch: data.patch }
  }
  return null
}

/**
 * Applies a patch from the frame to the host state. Only keys the state already has, with a
 * value of the same type, are taken, so the frame can change values but never the shape.
 * @param state - The current host state.
 * @param patch - The validated patch from the frame.
 * @returns A new state object.
 */
export const applyStatePatch = (state: CanvasState, patch: CanvasState): CanvasState =>
  Object.fromEntries(
    Object.entries(state).map(([key, value]) => {
      const patchedValue = Object.prototype.hasOwnProperty.call(patch, key) ? patch[key] : undefined
      return [key, typeof patchedValue === typeof value ? (patchedValue ?? value) : value]
    })
  )
