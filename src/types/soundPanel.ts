/** One sound a game lets the player edit: its default Strudel code and how it is rendered. */
export type SoundSlot = {
  id: string
  label: string
  /** The shipped Strudel code, which Reset restores. */
  code: string
  /** A loop repeats; a one-shot plays once. */
  kind: 'loop' | 'once'
  /**
   * How many cycles to render. A loop needs it; a one-shot without it is rendered for one
   * measured repetition, which a sound with a silent tail for its reverb has to override.
   */
  cycles?: number
  /** A loop of unrelated noise crossfades its own end into its start so the repeat does not click. */
  crossfadeSeam?: boolean
}

export type SoundSlotStatus = 'idle' | 'rendering' | 'applied' | 'error'

/**
 * Receives a rendered sound for a slot, or null when the slot was reset and the game should go
 * back to the file it ships with.
 */
export type SoundApplyHandler = (slotId: string, wav: ArrayBuffer | null) => void | Promise<void>
