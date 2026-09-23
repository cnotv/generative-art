import { computed, shallowRef } from 'vue'
import {
  historyCanRedo,
  historyCanUndo,
  historyCreate,
  historyGoTo,
  historyLog,
  historyPush,
  historyRedo,
  historyState,
  historyUndo
} from '@/utils/editorHistory'
import type { HistoryStack, HistoryStep } from '@/types/editorHistory'

/** How many states an editor keeps, the one it opened on included. */
export const EDITOR_HISTORY_LIMIT = 50

/**
 * Undo, redo and an action log for one editor, over whatever that editor uses as a snapshot.
 *
 * The editor records what each action produced and says what to call it; putting a state back on
 * screen is the editor's own job, since only it knows what a snapshot means. A model or document
 * loaded from scratch is a new history rather than another action, which is what `reopen` is for:
 * undoing back past a load into the previous model's keyframes would restore them onto bones that
 * no longer exist.
 * @param openingLabel What to call the state the editor opens in
 * @param openingSnapshot The state the editor opens in
 * @param restore Puts a snapshot back on screen; awaited, for a canvas that has to repaint
 * @param limit How many states to keep
 */
export const useEditorHistory = <TSnapshot>(
  openingLabel: string,
  openingSnapshot: TSnapshot,
  restore: (snapshot: TSnapshot) => void | Promise<void>,
  limit: number = EDITOR_HISTORY_LIMIT
) => {
  const stack = shallowRef<HistoryStack<TSnapshot>>(
    historyCreate(openingLabel, openingSnapshot, limit)
  )

  const step = async (
    move: (stack: HistoryStack<TSnapshot>) => HistoryStep<TSnapshot>
  ): Promise<void> => {
    const moved = move(stack.value)
    if (!moved.entry) return
    stack.value = moved.stack
    await restore(moved.entry.snapshot)
  }

  return {
    canUndo: computed(() => historyCanUndo(stack.value)),
    canRedo: computed(() => historyCanRedo(stack.value)),
    log: computed(() => historyLog(stack.value)),
    /**
     * Record what an action left behind.
     * @param label What the action is called in the log
     * @param snapshot The state the action produced
     */
    record: (label: string, snapshot: TSnapshot): void => {
      stack.value = historyPush(stack.value, label, snapshot)
    },
    /** Step back one action, restoring what it replaced. */
    undo: (): Promise<void> => step(historyUndo),
    /** Step forward into an action that was undone. */
    redo: (): Promise<void> => step(historyRedo),
    /**
     * Step straight to one action from the log instead of walking there.
     * @param index The action's place on the timeline, from the log
     */
    goTo: (index: number): Promise<void> => step((stack) => historyGoTo(stack, index)),
    /**
     * Start a fresh history, for an editor that has loaded something else entirely.
     * @param label What to call the state it now opens in
     * @param snapshot That state
     */
    reopen: (label: string, snapshot: TSnapshot): void => {
      stack.value = historyCreate(label, snapshot, limit)
    },
    /** The state on screen now, as the history understands it. */
    state: (): TSnapshot => historyState(stack.value)
  }
}
