/** One sound a game lets the player edit: its default Strudel code and how it is rendered. */
export type SoundSlot = {
  id: string
  label: string
  /** The shipped Strudel code, which Reset restores. */
  code: string
  /** A loop is rendered for `loopCycles` cycles; a one-shot for exactly one repetition. */
  kind: 'loop' | 'once'
  loopCycles?: number
}

export type SoundSlotStatus = 'idle' | 'rendering' | 'applied' | 'error'

/**
 * Receives a rendered sound for a slot, or null when the slot was reset and the game should go
 * back to the file it ships with.
 */
export type SoundApplyHandler = (slotId: string, wav: ArrayBuffer | null) => void | Promise<void>
