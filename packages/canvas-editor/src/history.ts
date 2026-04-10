export interface HistoryStack {
  past: string[]
  future: string[]
}

/**
 * Create a new empty history stack.
 * @returns Initial HistoryStack state
 */
export const historyCreate = (): HistoryStack => ({ past: [], future: [] })

/**
 * Push a new snapshot onto the history stack, clearing any redo future.
 * @param stack - Current history stack
 * @param snapshot - Canvas data URL snapshot to store
 * @returns Updated history stack
 */
export const historyPush = (stack: HistoryStack, snapshot: string): HistoryStack => ({
  past: [...stack.past, snapshot],
  future: []
})

/**
 * Undo the last action: moves the latest past snapshot to future.
 * @param stack - Current history stack
 * @returns Object with updated stack and the snapshot to restore (or null if nothing to undo)
 */
export const historyUndo = (
  stack: HistoryStack
): { stack: HistoryStack; snapshot: string | null } => {
  if (stack.past.length === 0) return { stack, snapshot: null }
  const snapshot = stack.past[stack.past.length - 1]
  const past = stack.past.slice(0, -1)
  return {
    stack: { past, future: [snapshot, ...stack.future] },
    snapshot: past[past.length - 1] ?? null
  }
}

/**
 * Redo the last undone action: moves the first future snapshot to past.
 * @param stack - Current history stack
 * @returns Object with updated stack and the snapshot to restore (or null if nothing to redo)
 */
export const historyRedo = (
  stack: HistoryStack
): { stack: HistoryStack; snapshot: string | null } => {
  if (stack.future.length === 0) return { stack, snapshot: null }
  const [snapshot, ...future] = stack.future
  return {
    stack: { past: [...stack.past, snapshot], future },
    snapshot
  }
}

/**
 * Whether an undo operation is available.
 * @param stack - Current history stack
 * @returns True if there is at least one past snapshot
 */
export const historyCanUndo = (stack: HistoryStack): boolean => stack.past.length > 0

/**
 * Whether a redo operation is available.
 * @param stack - Current history stack
 * @returns True if there is at least one future snapshot
 */
export const historyCanRedo = (stack: HistoryStack): boolean => stack.future.length > 0
