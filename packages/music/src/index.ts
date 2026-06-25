export type { MusicNoteEvent, MusicHap, MusicPatternName } from './types'

export { musicInit, musicPlay, musicStop, musicSetTempo } from './core'

export { musicEventsFromHaps } from './events'

export { musicMidiToStrudel, type MidiNoteInput } from './midi'

export { musicRandomDrums } from './generator'

export { MUSIC_PATTERNS, MUSIC_SONG } from './patterns'
