/** A scheduled note for rhythm gameplay, derived from a Strudel pattern. */
export interface MusicNoteEvent {
  /** Start time in seconds from the song start. */
  time: number
  /** Duration in seconds. */
  duration: number
  /** Lane/label the note maps to (e.g. the sound or note name). */
  value: string
}

/** A raw Strudel hap (event) as returned by querying a pattern. */
export interface MusicHap {
  whole?: { begin: number; end: number }
  value: unknown
}

/** Names of the built-in example patterns. */
export type MusicPatternName = 'drums' | 'bass' | 'melody' | 'song'
