import type { Timeline, ComplexModel } from './types'

/**
 * Generate unique ID for timeline actions
 * @returns Unique identifier string
 */
export const generateTimelineId = (): string => {
  return `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create timeline action with duration
 * @param start Starting frame
 * @param duration Duration in frames
 * @param action Action callback
 * @param options Additional timeline options
 * @returns Timeline object with calculated end frame
 */
export const createDurationAction = (
  start: number,
  duration: number,
  action: (element?: unknown) => void,
  options?: Partial<Timeline>
): Timeline => ({
  start,
  duration,
  action,
  id: generateTimelineId(),
  ...options
})

/**
 * Create one-shot action that runs once then auto-removes
 * @param frame Frame to execute on
 * @param action Action callback
 * @param options Additional timeline options
 * @returns Timeline object with autoRemove enabled
 */
export const createOneShotAction = (
  frame: number,
  action: (element?: unknown) => void,
  options?: Partial<Timeline>
): Timeline => ({
  start: frame,
  end: frame,
  action,
  autoRemove: true,
  id: generateTimelineId(),
  ...options
})

/**
 * Create interval-based action with auto-naming
 * @param interval [length, pause] in frames
 * @param action Action callback
 * @param options Additional timeline options
 * @returns Timeline object with interval configuration
 */
export const createIntervalAction = (
  interval: [number, number],
  action: (element?: unknown) => void,
  options?: Partial<Timeline>
): Timeline => ({
  interval,
  action,
  id: generateTimelineId(),
  name: options?.name || `interval_${interval[0]}_${interval[1]}`,
  ...options
})

/**
 * Check if action can be added (not blocked by performing state)
 * @param player ComplexModel with animation actions
 * @param blocking Blocking duration in milliseconds
 * @returns True if action can be added, false if blocked
 */
export const canAddAction = (player: ComplexModel, blocking: number = 0): boolean => {
  const currentAction = player.userData.actions?.[player.userData.currentAction as string]
  if (!currentAction) return true
  return currentAction.time >= blocking
}

/**
 * Derive the frame range a timeline action occupies, from whichever time
 * properties it defines (`start`/`end`, `start`+`duration`, or `delay`+`interval`).
 * @param action Timeline action to inspect
 * @returns Frame range `{ start, end }`, defaulting to a zero-length span at frame 0
 */
export const getTimelineActionSpan = (action: Timeline): { start: number; end: number } => {
  const start = action.start ?? action.delay ?? 0
  if (action.duration !== undefined) return { start, end: start + action.duration }
  if (action.end !== undefined) return { start, end: action.end }
  if (action.interval) return { start, end: start + action.interval[0] }
  return { start, end: start }
}
