import type { Timeline, ComplexModel } from './types';

/**
 * Generate unique ID for timeline actions
 * @returns Unique identifier string
 */
export const generateTimelineId = (): string => {
  return `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

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
  action: (element?: any) => void,
  options?: Partial<Timeline>
): Timeline => ({
  start,
  duration,
  action,
  id: generateTimelineId(),
  ...options,
});

/**
 * Create one-shot action that runs once then auto-removes
 * @param frame Frame to execute on
 * @param action Action callback
 * @param options Additional timeline options
 * @returns Timeline object with autoRemove enabled
 */
export const createOneShotAction = (
  frame: number,
  action: (element?: any) => void,
  options?: Partial<Timeline>
): Timeline => ({
  start: frame,
  end: frame,
  action,
  autoRemove: true,
  id: generateTimelineId(),
  ...options,
});

/**
 * Create interval-based action with auto-naming
 * @param interval [length, pause] in frames
 * @param action Action callback
 * @param options Additional timeline options
 * @returns Timeline object with interval configuration
 */
export const createIntervalAction = (
  interval: [number, number],
  action: (element?: any) => void,
  options?: Partial<Timeline>
): Timeline => ({
  interval,
  action,
  id: generateTimelineId(),
  name: options?.name || `interval_${interval[0]}_${interval[1]}`,
  ...options,
});

/**
 * Check if action can be added (not blocked by performing state)
 * @param player ComplexModel with animation actions
 * @param blocking Blocking duration in milliseconds
 * @returns True if action can be added, false if blocked
 */
export const canAddAction = (
  player: ComplexModel,
  blocking: number = 0
): boolean => {
  const currentAction = player.userData.actions?.[player.userData.currentAction];
  if (!currentAction) return true;
  return currentAction.time >= blocking;
};
