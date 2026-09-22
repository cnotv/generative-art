/** One step someone took, named for the log, holding the state that step produced. */
export interface HistoryEntry<TSnapshot> {
  label: string
  snapshot: TSnapshot
}

/**
 * Every state an editor has been in. `past` runs oldest first and its last entry is the state
 * on screen now; `future` holds what undo took away, earliest first, ready to be redone.
 */
export interface HistoryStack<TSnapshot> {
  past: HistoryEntry<TSnapshot>[]
  future: HistoryEntry<TSnapshot>[]
  limit: number
}

/** One line of the action log: what was done, and whether it still stands. */
export interface HistoryLogEntry {
  label: string
  undone: boolean
}

/** A stack after a move, with the state to put back on screen, or null when nothing moved. */
export interface HistoryStep<TSnapshot> {
  stack: HistoryStack<TSnapshot>
  entry: HistoryEntry<TSnapshot> | null
}
