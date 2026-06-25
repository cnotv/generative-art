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
).cpm(120)`,
  techno: `stack(
  s("bd*4"),
  s("[~ hh]*2").gain(0.5),
  s("~ cp ~ cp").gain(0.6),
  note("c2 c2 eb2 c2").s("sawtooth").lpf(700)
).cpm(132)`,
  house: `stack(
  s("bd*4"),
  s("~ ho ~ ho").gain(0.5),
  s("~ cp"),
  note("<c2 c3> <eb2 g2>").s("sawtooth").lpf(900).gain(0.7)
).cpm(124)`,
  breakbeat: `stack(
  s("bd ~ [~ bd] sd"),
  s("hh*8").gain(0.4),
  note("c1 ~ g1 ~ eb1 ~ g1 c2").s("square").lpf(500).gain(0.6)
).cpm(140)`,
  ambient: `stack(
  note("<c3 e3 g3 a3>").s("triangle").slow(4).gain(0.5),
  note("<c5 g5 e5 b4>").s("sine").slow(8).gain(0.3)
).cpm(60)`
}

/** The default complex song used as a rhythm-game track. */
export const MUSIC_SONG: string = MUSIC_PATTERNS.song
