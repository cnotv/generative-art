import type { StrudelExample, StrudelTabId, TranscriptionStage } from './types'

/**
 * The Strudel audio engine stays under AGPL-3.0-or-later while this repo is MIT.
 * Depending on it here means a deployed build of this view carries that obligation.
 */
export const STRUDEL_LICENSE_NOTE =
  'Strudel engine (AGPL-3.0-or-later) isolated to this view. See https://codeberg.org/uzu/strudel'

export const STRUDEL_EXAMPLES: StrudelExample[] = [
  {
    id: 'first-beat',
    label: 'First beat',
    code: 's("bd sd, hh*8")'
  },
  {
    id: 'four-floor',
    label: 'Four floor',
    code: 's("bd*4, hh*8, sd(3,4)")'
  },
  {
    id: 'bass-jux',
    label: 'Bass jux',
    code: 's("bd*2,hh(3,4),jvbass(5,8,1)").jux(rev)'
  },
  {
    id: 'soft-melody',
    label: 'Soft melody',
    code: 'note("c3 [e3 g3] a3 [g3 e3]").s("triangle").lpf(800)'
  },
  {
    id: 'sliders-and-scopes',
    label: 'Sliders and scopes',
    code: `// Drag the sliders while it plays; the pianoroll and scope draw under their lines.
$: note("<c3 eb3 g3 bb3>*8").s("sawtooth")
  .lpf(slider(1200, 200, 4000))
  .delay(slider(0.4))
  .pan(rand)
  ._pianoroll()
$: note("<c2 c2 g1 bb1>").s("square").lpf(400)
  ._scope()
$: s("bd*4, [~ hh]*4")`
  },
  {
    id: 'punchcard-drums',
    label: 'Punchcard drums',
    code: `// One row per drum and one block per hit; the blocks light up as they play.
stack(
  s("bd*2 [~ bd] ~").color("lightpink"),
  s("~ sd ~ sd").color("plum"),
  s("hh*8").gain(.6).color("lightblue"),
  s("~ ~ ~ cp").color("palegreen")
)._punchcard()`
  },
  {
    id: 'punchcard-vs-pianoroll',
    label: 'Punchcard vs pianoroll',
    code: `// From strudel.cc's visual feedback guide: both draw the same notes as a pianoroll.
// _punchcard draws the pattern after everything chained onto it, so the cyan shows.
// _pianoroll draws the pattern as it stands at that call, so its notes stay white.
$: note("c a f e").color("white")
  ._punchcard()
  .color("cyan")
$: note("c a f e").color("white")
  ._pianoroll()
  .color("cyan")`
  },
  {
    id: 'scope',
    label: 'Scope',
    code: `// From strudel.cc's visual feedback guide: the scope draws the waveform as it sounds.
// A sawtooth climbs and drops, so its scope is a row of ramps.
$: s("sawtooth")._scope()
// Options: thickness, scale (height), pos (0 top to 1 bottom), align and trigger.
// The line takes its colour from .color(), which the scope reads off the pattern.
$: note("<c4 eb4 g4 bb4>*2").s("triangle").gain(.6).color("plum")
  ._scope({ thickness: 2, scale: .5 })`
  },
  {
    id: 'spiral',
    label: 'Spiral',
    code: `// The spiral turns once per cycle and draws each note along it as it plays.
$: note("c2 a2 eb2")
  .euclid(5, 8)
  .s("sawtooth")
  .lpenv(4).lpf(300)
  .color("plum")
  ._spiral({ steady: .96, inset: 2, colorizeInactive: 1 })
$: s("bd*4, [~ hh]*4").gain(.8)`
  },
  {
    id: 'pitch-wheel',
    label: 'Pitch wheel',
    code: `// The twelve pitch classes sit round a wheel; the notes playing now join into a shape.
chord("<Cm7 Fm7 Ab^7 G7>")
  .voicing()
  .s("triangle")
  .room(.4)
  .color("lightblue")
  ._pitchwheel()`
  },
  {
    id: 'spectrum',
    label: 'Spectrum',
    code: `// The spectrum shows how loud each frequency is, scrolling as the sound changes.
n("<0 4 <2 3> 1>*3")
  .off(1/8, add(n(5)))
  .off(1/5, add(n(7)))
  .scale("d3:minor:pentatonic")
  .s("sine")
  .dec(.3).room(.5)
  .color("palegreen")
  ._spectrum()`
  },
  {
    id: 'pianoroll-behind',
    label: 'Pianoroll behind the code',
    code: `// Without the underscore, a visual fills the editor behind the code.
$: stack(
  note("<[c3,eb3,g3] [ab2,c3,eb3] [bb2,d3,f3] [g2,bb2,d3]>")
    .s("sawtooth").lpf(1200).release(.3).gain(.5).color("thistle"),
  note("<c2 ab1 bb1 g1>*8").s("square").lpf(400).gain(.6).color("lightpink"),
  note("<[g4 eb4] [c5 ~] [d5 f5] [~ bb4]>*2").s("triangle").delay(.3).color("lightblue")
).pianoroll({ cycles: 4, playhead: .5, fold: 0, minMidi: 30, maxMidi: 84 })
$: s("bd*4, [~ hh]*4").gain(.8)`
  }
]

export const ELECTRO_TUNES: StrudelExample[] = [
  {
    id: 'caverave',
    label: 'Caverave',
    code: `// "Caverave"
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos

const keys = x => x.s('sawtooth').cutoff(1200).gain(.5)
  .attack(0).decay(.16).sustain(.3).release(.1);

const drums = stack(
  s("bd*2").mask("<x@7 ~>/8").gain(.8),
  s("~ <sd!7 [sd@3 ~]>").mask("<x@7 ~>/4").gain(.5),
  s("[~ hh]*2").delay(.3).delayfeedback(.5).delaytime(.125).gain(.4)
);

const synths = stack(
  "<eb4 d4 c4 b3>/2"
  .scale("<C:minor!3 C:melodic:minor>/2")
  .struct("[~ x]*2")
  .layer(
    x=>x.scaleTranspose(0).early(0),
    x=>x.scaleTranspose(2).early(1/8),
    x=>x.scaleTranspose(7).early(1/4),
    x=>x.scaleTranspose(8).early(3/8)
  ).note().apply(keys).mask("<~ x>/16")
  .color('darkseagreen'),

  note("<C2 Bb1 Ab1 [G1 [G2 G1]]>/2")
  .struct("[x [~ x] <[~ [~ x]]!3 [x x]>@2]/2".fast(2))
  .s('sawtooth').attack(0.001).decay(0.2).sustain(1).cutoff(500)
  .color('brown'),
  chord("<Cm7 Bb7 Fm7 G7b13>/2")
  .struct("~ [x@0.2 ~]".fast(2))
  .dict('lefthand').voicing()
  .every(2, early(1/8))
  .apply(keys).sustain(0)
  .delay(.4).delaytime(.12)
  .mask("<x@7 ~>/8".early(1/4))
).add(note("<-1 0>/8"))
stack(
  drums.fast(2).color('tomato'),
  synths
).slow(2)`
  },
  {
    id: 'good-times',
    label: 'Good times',
    code: `// "Good times" (adapted: .piano() replaced with triangle synth)
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos

const scale = cat('C3 dorian','Bb2 major').slow(4);
stack(
  n("2*4".add(12)).off(1/8, add(2))
  .scale(scale)
  .fast(2)
  .add("<0 1 2 1>").hush(),
  "<0 1 2 3>(3,8,2)".off(1/4, add("2,4"))
  .n().scale(scale),
  n("<0 4>(5,8,-1)").scale(scale).sub(note(12))
)
  .gain(".6 .7".fast(4))
  .add(note(4))
  .s('triangle')
  .clip(2)
  .mul(gain(.8))
  .slow(2)`
  },
  {
    id: 'flatrave',
    label: 'Flatrave',
    code: `// "Flatrave" (adapted: RolandTR909 bank replaced with default dirt-samples)
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos

useRNG('legacy')

stack(
  s("bd*2,~ [cp,sd]"),

  s("hh:1*4").sometimes(fast("2"))
  .rarely(x=>x.speed(".5").delay(.5))
  .end(perlin.range(0.02,.05).slow(8))
  .room(.5)
  .gain("0.4,0.4(5,8,-1)"),

  note("<0 2 5 3>".scale('G1 minor')).struct("x(5,8,-1)")
  .s('sawtooth').decay(.1).sustain(0)
  .lpa(.1).lpenv(-4).lpf(800).lpq(8),

  note("<G4 A4 Bb4 A4>,Bb3,D3").struct("~ x*2").s('square').clip(1)
  .cutoff(sine.range(500,4000).slow(16)).resonance(10)
  .decay(sine.slow(15).range(.05,.2)).sustain(0)
  .room(.5).gain(.3).delay(.2).mask("<0 1@3>/8"),

  "0 5 3 2".sometimes(slow(2)).off(1/8,add(5)).scale('G4 minor').note()
  .decay(.05).sustain(0).delay(.2).degradeBy(.5).mask("<0 1>/16")
)`
  },
  {
    id: 'amensister',
    label: 'Amensister',
    code: `// "Amensister" (adapted: custom samples replaced with default dirt-samples)
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos

useRNG('legacy')

stack(
  // amen break using default samples
  n("0 1 2 3 4 5 6 7")
  .sometimes(x=>x.ply(2))
  .rarely(x=>x.speed("2 | -2"))
  .sometimesBy(.4, x=>x.delay(".5"))
  .s("sd")
  .slow(2)
  .room(.5)
  ,
  // bass
  sine.add(saw.slow(4)).range(0,7).segment(8)
  .superimpose(x=>x.add(.1))
  .scale('G0 minor').note()
  .s("sawtooth")
  .gain(.4).decay(.1).sustain(0)
  .lpa(.1).lpenv(-4).lpq(10)
  .cutoff(perlin.range(300,3000).slow(8))
  .degradeBy("0 0.1 .5 .1")
  .rarely(add(note("12")))
  ,
  // chord
  note("Bb3,D4".superimpose(x=>x.add(.2)))
  .s('sawtooth').lpf(1000).struct("<~@3 [~ x]>")
  .decay(.05).sustain(.0).delay(.8).delaytime(.125).room(.8)
  ,
  // hat texture
  s("hh").room(1).shape(.6).chop(16).rev().mask("<x ~@7>")
  ,
  n("0 1").s("cp").delay(.5).degradeBy(.8).speed(rand.range(.5,1.5))
).reset("<x@7 x(5,8,-1)>")`
  },
  {
    id: 'dinofunk',
    label: 'Dinofunk',
    code: `// "Dinofunk" (adapted: freesound URLs replaced with default dirt-samples)
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos

setcps(1)
useRNG('legacy')

stack(
  s('bd').loopAt(8).clip(1),
  s("bd*2, ~ sd,hh*4"),
  chord("Abm7")
  .mode("below:G4")
  .dict('lefthand')
  .voicing()
  .struct("x(3,8,1)".slow(2)),
  "0 1 2 3".scale('ab4 minor pentatonic')
  .superimpose(x=>x.add(.1))
  .sometimes(x=>x.add(12))
  .note().s('sawtooth')
  .cutoff(sine.range(400,2000).slow(16)).gain(.8)
  .decay(perlin.range(.05,.2)).sustain(0)
  .delay(sine.range(0,.5).slow(32))
  .degradeBy(.4).room(1),
  note("<b4 eb4>").s('sd').delay(.8).slow(8).room(.5)
)`
  },
  {
    id: 'bike',
    label: 'Bike (Autechre)',
    code: `// "Bike" by Autechre, typed in from a songscription score
// Approximate: 22 bars of 3/4 at 125 BPM, pitches read off the chord symbols
// (Dm/A, Am, Dm, Am/C, Dm) rather than every printed note.

setcps(125/60/3)

stack(
  // sampler: staccato sixteenth-note chord stabs
  note("<[a4,d5,f5]!2 [a4,c5,e5]!4 [d5,f5,a5]!7 [c5,e5,a5]!4 [d5,f5,a5]!5>")
  .struct("<[~ ~ ~ ~ ~ ~ ~ ~ x x x x] [x*12]!2 [x x x x x x x x x@3 x] [~ ~ x ~ ~ x x ~ ~ ~ x ~] [x*12]!9 [x x x x x x x x x ~ ~ x] [x ~ x ~ ~ x ~ x x x x x] [~ x@2 ~ x x x ~ x x ~ x] [x ~ x x ~ x ~ x ~ x x ~] [x x x ~ x x x x x x x x] [x x x x x x ~ x ~ ~ x ~] [~ x x ~ ~ x x x x x x x] [x x x ~ ~ ~ ~ ~ ~ ~ ~ ~]>")
  .s("square").decay(.09).sustain(0).lpf(2800).gain(.35).room(.3),
  // drums: hi-hats from bar 17, kick and snare in the last bar
  s("<~!16 hh(5,12,2)!5 [bd hh sd hh bd sd ~ ~ ~ ~ ~ ~]>").gain(.8),
  // bass: only in the last bar
  note("<~!21 [d2 d2 d2 ~ a1 a1 ~ ~ ~ ~ ~ ~]>").s("sawtooth").lpf(500).gain(.6)
)`
  }
]

export const DEFAULT_STRUDEL_EXAMPLE_ID = 'first-beat'
/** Where the code on screen is kept between visits. */
export const STRUDEL_SAVED_CODE_STORAGE_KEY = 'strudel-editor-code'

/**
 * Classic TR-909 style kit the shipped examples play. Loaded once before the first
 * evaluation, or every trigger fails with "sound not found".
 */
export const DEFAULT_SAMPLE_BANK = 'github:tidalcycles/dirt-samples'

export const STRUDEL_TABS: { id: StrudelTabId; label: string }[] = [
  { id: 'welcome', label: 'welcome' },
  { id: 'patterns', label: 'patterns' },
  { id: 'import', label: 'import' },
  { id: 'sounds', label: 'sounds' },
  { id: 'reference', label: 'reference' },
  { id: 'export', label: 'export' },
  { id: 'console', label: 'console' },
  { id: 'settings', label: 'settings' }
]

/** Analysis runs on mono audio resampled to this rate; it keeps hi-hats below Nyquist. */
export const TRANSCRIPTION_SAMPLE_RATE = 22050
export const TRANSCRIPTION_MAX_SECONDS = 90
export const TRANSCRIPTION_MAX_BARS = 64
export const TRANSCRIPTION_ACCEPTED_TYPES = 'audio/*,.mp3,.wav,.ogg,.m4a,.flac'

export const ONSET_FRAME_SIZE = 1024
export const ONSET_HOP_SIZE = 512
export const ONSET_THRESHOLD_RADIUS_FRAMES = 8
export const ONSET_THRESHOLD_OFFSET = 0.1

/** Four times the onset frame, so neighbouring bass semitones land in different bins. */
export const PITCH_FRAME_SIZE = 4096

export const TEMPO_MIN_BPM = 70
export const TEMPO_MAX_BPM = 180
/** Centre of the log-tempo prior that breaks ties between related tempos. */
export const TEMPO_PRIOR_CENTER_BPM = 120
export const TEMPO_PRIOR_WIDTH_OCTAVES = 1

export const STEPS_PER_BEAT = 4
export const STEPS_PER_BAR = 16

export const DRUM_LOW_BAND_MAX_HZ = 150
export const DRUM_HIGH_BAND_MIN_HZ = 5000
export const DRUM_KICK_MIN_SHARE = 0.4
export const DRUM_HAT_MIN_SHARE = 0.3
export const DRUM_SNARE_MIN_SHARE = 0.5

export const BASS_MIN_HZ = 40
export const BASS_MAX_HZ = 250
/** A bass peak quieter than this fraction of the loudest bin is treated as no bass. */
export const BASS_MIN_RELATIVE_LEVEL = 0.25

export const CHROMA_MIN_HZ = 110
export const CHROMA_MAX_HZ = 2000
/** A flat, noise-like chroma scores 0.5 against every triad, so the bar sits above it. */
export const CHORD_MIN_SIMILARITY = 0.6

export const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
export const CHORD_ROOT_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const TRANSCRIPTION_STAGE_LABELS: Record<TranscriptionStage, string> = {
  decoding: 'Decoding audio',
  onsets: 'Finding note onsets',
  tempo: 'Estimating tempo',
  notes: 'Reading drums, bass and chords',
  done: 'Done'
}

export const SECONDS_PER_MINUTE = 60

/** strudel.cc's own colours, applied to the editor alone rather than the page. */
export const STRUDEL_EDITOR_THEME = 'strudelTheme'
export const STRUDEL_EDITOR_ARIA_LABEL = 'Live code pattern'
/** Seconds of pattern either side of now that pianoroll and scope painters see. */
export const STRUDEL_DRAW_TIME: [number, number] = [-2, 2]
export const STRUDEL_NO_DRAW_TIME: [number, number] = [0, 0]

/**
 * Strudel's `getDrawContext()` draws on the element with this id, and creates a full-window
 * canvas pinned over the whole page when there is none. Naming the editor's background
 * canvas so keeps `.pianoroll()` and `.scope()` behind the code, as on strudel.cc.
 */
export const STRUDEL_DRAW_CANVAS_ID = 'test-canvas'

/** How long completion may wait for the parser to reach the cursor before using what it has. */
export const STRUDEL_COMPLETION_PARSE_TIMEOUT_MS = 50
/** How far before a string to look for the call it belongs to, such as `s(` or `.scale(`. */
export const STRUDEL_COMPLETION_CALLEE_LOOKBEHIND = 40
export const STRUDEL_COMPLETION_PITCH_NAMES = [
  'C',
  'C#',
  'Db',
  'D',
  'D#',
  'Eb',
  'E',
  'F',
  'F#',
  'Gb',
  'G',
  'G#',
  'Ab',
  'A',
  'A#',
  'Bb',
  'B'
]
