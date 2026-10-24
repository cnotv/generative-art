import { complex } from '@strudel/tonal'
import { ScaleType } from '@tonaljs/tonal'
import strudelDocumentation from './strudelDocumentation.json'
import type { StrudelCompletionVocabulary } from '../types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// superdough keeps its sounds in a nanostores map, which @strudel/webaudio re-exports untyped.
const readSoundNames = (webaudioModule: unknown): string[] => {
  const soundMap = isRecord(webaudioModule) ? webaudioModule.soundMap : undefined
  const readSounds = isRecord(soundMap) ? soundMap.get : undefined
  const sounds: unknown = typeof readSounds === 'function' ? readSounds.call(soundMap) : undefined
  return isRecord(sounds) ? Object.keys(sounds).sort() : []
}

/**
 * What the code editor completes from: the docs generated from Strudel's sources, the chord
 * symbols `chord()` voices, Tonal's scale names, and the sounds the engine has registered.
 * @returns the vocabulary for the completion source
 */
export const createCompletionVocabulary = (): StrudelCompletionVocabulary => ({
  functionDocumentations: strudelDocumentation,
  chordSymbols: ['', ...Object.keys(complex)].sort(),
  scaleNames: ScaleType.names(),
  // The same module instance playback loads, so its sounds are there once Play has run.
  listSoundNames: async () => readSoundNames(await import('@strudel/webaudio'))
})
