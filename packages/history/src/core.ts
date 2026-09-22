import type { HistoryEntry, HistoryLogEntry, HistoryStack, HistoryStep } from './types'

/**
 * Open a history on the state an editor starts in. That first state is not an action and never
 * appears in the log, but undo needs somewhere to land, so it is what the first undo restores.
 * @param label What to call the opening state
 * @param snapshot The state the editor opens in
 * @param limit How many states to keep, the opening one included
 * @returns A history holding only the opening state
 */
export const historyCreate = <TSnapshot>(
  label: string,
  snapshot: TSnapshot,
  limit: number
): HistoryStack<TSnapshot> => ({ past: [{ label, snapshot }], future: [], limit })

/** The state on screen now, which is always the newest one not undone. */
export const historyState = <TSnapshot>(stack: HistoryStack<TSnapshot>): TSnapshot =>
  stack.past[stack.past.length - 1].snapshot

/**
 * Record what an action left behind. The snapshot is the state *after* the action, so undo has
 * the state before it already sitting behind it and needs no second reading of the editor.
 * @param stack The current history
 * @param label What the action is called in the log
 * @param snapshot The state the action produced
 * @returns The history with the action recorded and anything undone discarded
 */
export const historyPush = <TSnapshot>(
  stack: HistoryStack<TSnapshot>,
  label: string,
  snapshot: TSnapshot
): HistoryStack<TSnapshot> => ({
  past: [...stack.past, { label, snapshot }].slice(-stack.limit),
  future: [],
  limit: stack.limit
})

/**
 * Step back one action.
 * @param stack The current history
 * @returns The history and the state to restore, or the same history and null at the oldest state
 */
export const historyUndo = <TSnapshot>(stack: HistoryStack<TSnapshot>): HistoryStep<TSnapshot> => {
  if (!historyCanUndo(stack)) return { stack, entry: null }
  const undone = stack.past[stack.past.length - 1]
  const past = stack.past.slice(0, -1)
  return {
    stack: { past, future: [undone, ...stack.future], limit: stack.limit },
    entry: past[past.length - 1]
  }
}

/**
 * Step forward into an action that was undone.
 * @param stack The current history
 * @returns The history and the state to restore, or the same history and null with nothing undone
 */
export const historyRedo = <TSnapshot>(stack: HistoryStack<TSnapshot>): HistoryStep<TSnapshot> => {
  if (!historyCanRedo(stack)) return { stack, entry: null }
  const [redone, ...future] = stack.future
  return { stack: { past: [...stack.past, redone], future, limit: stack.limit }, entry: redone }
}

/** Whether there is an action to step back from; the state an editor opened on is not one. */
export const historyCanUndo = <TSnapshot>(stack: HistoryStack<TSnapshot>): boolean =>
  stack.past.length > 1

/** Whether an undone action is waiting to be put back. */
export const historyCanRedo = <TSnapshot>(stack: HistoryStack<TSnapshot>): boolean =>
  stack.future.length > 0

/**
 * Every action taken, newest first, each marked with whether it still stands. The state the
 * editor opened on is left out: it is where undo lands, not something anybody did.
 * @param stack The current history
 * @returns One line per action, newest first
 */
export const historyLog = <TSnapshot>(stack: HistoryStack<TSnapshot>): HistoryLogEntry[] => {
  const done = stack.past.slice(1).map((entry: HistoryEntry<TSnapshot>) => ({
    label: entry.label,
    undone: false
  }))
  const undone = stack.future.map((entry: HistoryEntry<TSnapshot>) => ({
    label: entry.label,
    undone: true
  }))
  return [...done, ...undone].reverse()
}
