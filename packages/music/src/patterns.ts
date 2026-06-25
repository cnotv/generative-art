import type { MusicPatternName } from './types'

/** Named Strudel patterns, including a longer layered song for the rhythm game. */
export const MUSIC_PATTERNS: Record<MusicPatternName, string> = {
  drums: `s("bd hh sd hh")`,
  bass: `note("c2 c2 g1 a1").s("sawtooth").lpf(400)`,
  melody: `note("c4 e4 g4 b4 a4 g4 e4 c4").s("triangle")`,
  song: `stack(
  s("bd*2 [~ hh] sd [hh hh]"),
  note("<c2 g1 a1 f1>").s("sawtooth").lpf(sine.range(300, 1200).slow(8)),
  note("c4 e4 g4 e4 a4 g4 e4 d4").s("triangle").gain(0.6).slow(2)
).cpm(120)`
}

/** The default complex song used as a rhythm-game track. */
export const MUSIC_SONG: string = MUSIC_PATTERNS.song
