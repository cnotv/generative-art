import type { InjectionKey } from 'vue'

/** Plays a sound by its registered name, so a picker can let the user hear what they pick. */
export const STRUDEL_FLOW_PREVIEW_SOUND: InjectionKey<(soundName: string) => void> = Symbol(
  'strudel-flow-preview-sound'
)
