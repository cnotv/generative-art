import type {
  DrumSound,
  ImportCodeOptions,
  StrudelExample,
  StrudelExportOptions,
  StrudelInstrumentRole,
  StrudelMusicStyle,
  StrudelPatternIdea,
  StrudelSampleBank,
  StrudelSoundFilter,
  StrudelTabId,
  StrudelVisualName,
  TranscriptionStage
} from './types'

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
    id: 'coin',
    label: 'Coin',
    code: 'note("b5 e6@3 ~@4").s("square").decay(.4).sustain(0).gain(.4).fast(2)'
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
    id: 'megalovania-riff',
    label: 'Megalovania riff (Toby Fox)',
    code: `// "Megalovania" by Toby Fox, the riff typed in from a guitar tab
// One bar of sixteenth notes at 121 BPM; only the first two notes change,
// stepping down D, C, B, B flat over four bars.

setcpm(121/4)

note("<d4 c4 b3 bb3>!2 d5 ~ a4 ~ ~ g#4 ~ g4 ~ f4@2 d4 f4 g4")
  .s("gm_overdriven_guitar")`
  },
  {
    id: 'breakfast-in-america',
    label: 'Breakfast in America (Supertramp)',
    code: `// "Breakfast in America" by Supertramp, the guitar part typed in from a tab:
// intro, verse, bridge, verse, bridge. The tab speeds up from 70 to 74 BPM;
// this keeps 72.

setcpm(72/4)

// One bar each, in eighth notes: a chord on the beat, a bass note between.
const intro = note("[[c4,eb4,g4] g3]*4")
const cmToBb = note("[[c4,eb4,g4] g3]*2@4 [[bb3,d4,f4] f3]*2@4")
const abToBb = note("[[ab3,c4,eb4] eb3]*3@6 [ab3,c4,eb4,ab2] [bb3,d4,f4,bb2]")
const abHeld = note("[[ab3,c4,eb4] eb3]*3@6 [ab3,c4,eb4,ab2]@2")
const gOverB = note("[[b3,d4,g4] g3]*4")
const cmHigh = note("[[c4,eb4,g4,c5] g3]*4")
// Fm9 then B flat, the low F held under the second Fm9
const fm9ToBb = note("[ab3,c4,eb4,g4]@2 [ab3,c4,eb4,g4] ~ [f3,bb3,d4,f4]@2 [f3,bb3,d4,f4] ~, f2@4 bb2@3 bb2")
// The 2/4 bar fills the first half of its cycle, the only half arrange plays
const bbTwoBeats = note("[[f3,bb3,d4,f4] bb2]*2 ~")

const verse = [[1, cmToBb], [1, abToBb], [1, cmToBb], [1, abHeld], [1, gOverB], [1, cmHigh], [1, gOverB]]
const bridge = [[2, fm9ToBb], [0.5, bbTwoBeats]]

arrange([2, intro], ...verse, ...bridge, ...verse, ...bridge)
  .s("gm_acoustic_guitar_steel")`
  },
  {
    id: 'come-as-you-are-riff',
    label: 'Come as You Are riff (Nirvana)',
    code: `// "Come as You Are" by Nirvana, the intro riff typed in from a guitar tab
// Tuned a whole step down, so the open low string is D; two bars of eighth
// notes at 120 BPM, every note left ringing into the next.

setcpm(120/4)

note("<[e2@2 g2 e2 g2 e2 e2 eb2] [d2 a2 d2 d2@2 a2 d2 eb2]>")
  .s("gm_electric_guitar_clean").clip(2).room(.3)`
  },
  {
    id: 'concrete-hours',
    label: 'Concrete Hours (techno)',
    code: `// Concrete Hours: a techno song in F minor
// Sixty-four bars: intro, build, main, break, main, outro. Each string holds one number a bar.
setcpm(130/4)

$: s("bd*4").bank("RolandTR909").gain(.5).mask("<1!40 0!8 1!16>")._punchcard()
$: s("[~ hh]*4").bank("RolandTR909").gain(.35).mask("<0!4 1!60>")
$: s("~ cp ~ cp").bank("RolandTR909").gain(.3).mask("<0!16 1!16 0!8 1!16 0!8>")
$: stack(
  note("[~ f1 f1 ab1]*4").add(note("<0 0 0 -2>")).s("sawtooth")
    .lpf("<300!16 500!16 900!8 500!16 300!8>").decay(.12).sustain(0).gain(.55),
  chord("<Fm7 Fm7 Fm7 Ebm7>").voicing().struct("~ [~ x] ~ [x ~]").s("sawtooth")
    .lpf(1400).decay(.1).sustain(0).room(.3).delay(.3).gain(.15)
    .mask("<0!16 1!40 0!8>")
).mask("<0!8 1!48 0!8>")._scope()
$: s("perc(3,8,2)").hpf(500).gain(.4).pan(.7).mask("<0!16 1!40 0!8>")`
  },
  {
    id: 'second-floor',
    label: 'Second Floor (house)',
    code: `// Second Floor: a deep house song in A minor
// Fifty-six bars: intro, groove, chorus, break, chorus, outro. Each string holds one number a bar.
setcpm(124/4)

$: s("bd*4").bank("RolandTR909").gain(.5).mask("<1!36 0!4 1!16>")._punchcard()
$: s("[~ hh]*4").bank("RolandTR909").gain(.3)
$: s("~ cp ~ cp").bank("RolandTR909").gain(.3).mask("<0!8 1!44 0!4>")
$: note("[~ a1] [~ a1] [~ a1 ~ a1] [~ e2]").add(note("<0 5 8 7>")).s("sawtooth")
  .lpf(420).decay(.18).sustain(0).gain(.55).mask("<0!8 1!44 0!4>")
$: stack(
  chord("<Am7 Dm7 F^7 Em7>").voicing().struct("[~ x] ~ [~ x] [~ ~ x ~]").s("gm_epiano1")
    .room(.4).gain(.35),
  n("<[~ 7 ~ 9 ~ 7 4 ~] [~ 5 ~ 7 ~ 5 3 ~] [~ 7 ~ 9 ~ 11 9 ~] [~ 6 ~ 8 ~ 6 4 ~]>")
    .scale("A3:minor").s("gm_vibraphone").delay(.3).room(.3).gain(.3)
    .mask("<0!20 1!16 0!4 1!16>")
)._pianoroll()`
  },
  {
    id: 'long-way-down',
    label: 'Long Way Down (drum and bass)',
    code: `// Long Way Down: a drum and bass song in D minor
// Sixty-four bars: intro, drop, break, drop, outro. Each string holds one number a bar.
setcpm(174/4)

$: s("bd ~ ~ ~ ~ bd ~ ~").gain(.45).mask("<0!16 1!24 0!8 1!16>")._spectrum()
$: s("~ ~ sd ~ ~ ~ sd ~").gain(.35).mask("<0!16 1!24 0!8 1!16>")
$: stack(
  s("hh*8").gain("[1.2 .8]*4"),
  s("breaks165").fit().gain(.2).hpf(600).mask("<0!16 1!24 0!8 1!16>")
).mask("<0!8 1!56>")
$: stack(
  note("<d2 d2 bb1 a1>").s("sine").shape(.8).postgain(.2).mask("<0!16 1!24 0!8 1!16>"),
  note("<d2 d2 bb1 a1>").s("sawtooth").add(note("0,.1")).lpf(380).gain(.15)
    .mask("<0!16 1!24 0!8 1!16>"),
  chord("<Dm7 Dm7 Bb^7 A7>").voicing().s("sawtooth").lpf(900).attack(.4).release(1)
    .room(.6).gain(.12)
)._scope()`
  },
  {
    id: 'corner-store',
    label: 'Corner Store (hip hop)',
    code: `// Corner Store: a lofi hip hop song in C minor
// Forty bars: intro, verse, hook, verse, outro. Each string holds one number a bar.
setcpm(90/4)

$: s("bd ~ ~ bd ~ bd ~ ~").bank("RolandTR808").gain(.65).mask("<0!4 1!32 0!4>")._punchcard()
$: s("~ ~ sd ~ ~ ~ sd ~").bank("RolandTR808").gain(.5).mask("<0!4 1!32 0!4>")
$: s("hh*8").bank("RolandTR808").gain("[.3 .2]*4").swingBy(1/6, 4).mask("<0!4 1!36>")
$: stack(
  chord("<Cm7 Ab^7 Fm7 G7>").voicing().s("gm_epiano1").room(.4).crush(8).gain(.42),
  n("<[7 ~ 9 ~ ~ 7 ~ 4] [5 ~ ~ 4 ~ 2 ~ ~] [3 ~ 5 ~ ~ 3 ~ 2] [1 ~ ~ 2 ~ ~ ~ ~]>")
    .scale("C4:minor").s("gm_vibraphone").delay(.4).room(.3).gain(.4)
    .mask("<0!20 1!8 0!12>")
)._pianoroll()
$: note("<[c2 ~ ~ c2 ~ eb2 ~ ~] [ab1 ~ ~ ab1 ~ c2 ~ ~] [f1 ~ ~ f1 ~ ab1 ~ ~] [g1 ~ ~ g1 ~ b1 ~ ~]>")
  .s("triangle").shape(.3).postgain(.7).mask("<0!4 1!32 0!4>")`
  },
  {
    id: 'tideline',
    label: 'Tideline (ambient)',
    code: `// Tideline: an ambient piece in D major
// Thirty-two bars: chords alone, then the drone, the melody, and the chords alone again.
setcpm(70/4)

$: chord("<D^7 Bm7 G^7 A7>").voicing().s("triangle").slow(2)
  .attack(1.5).release(3).room(.8).roomsize(6).gain(.2)._spiral()
$: n("<0 ~ 4 ~ 7 ~ 4 ~ 9 ~ 7 ~ 4 ~ 2 ~>").scale("D4:major:pentatonic").s("sine")
  .attack(.05).decay(1.5).sustain(0).delay(.5).delaytime(.5).delayfeedback(.5).room(.7).gain(.4)
  .mask("<0!12 1!16 0!4>")
$: note("<d2 b2 g2 a2>").s("sine").slow(2).shape(.5).postgain(.25).attack(1.5).release(3)
  .mask("<0!4 1!24 0!4>")._spectrum()`
  },
  {
    id: 'lift-off',
    label: 'Lift Off (trance)',
    code: `// Lift Off: an uplifting trance song in A minor
// Sixty-four bars: intro, theme, breakdown with a riser, drop, outro. One number a bar.
setcpm(138/4)

$: s("bd*4").bank("RolandTR909").gain(.5).mask("<1!24 0!16 1!24>")._spectrum()
$: stack(
  s("[~ hh]*4").bank("RolandTR909").gain(.3).mask("<0!8 1!16 0!16 1!24>"),
  s("sd*16").gain("<0!36 .1 .2 .3 .4 0!24>")
)
$: note("[~ a1 a1 a1]*4").add(note("<0 -4 3 -2>")).s("sawtooth").lpf(600)
  .decay(.1).sustain(0).gain(.55).mask("<0!8 1!16 0!16 1!16 0!8>")
$: stack(
  n("0 2 4 7 9 7 4 2").fast(2).scale("<A3:minor F3:major C4:major G3:major>")
    .s("sawtooth").lpf("<800!8 1400!16 1000!8 2400!8 3000!16 1400!8>").decay(.12).sustain(0)
    .delay(.3).room(.3).gain(.25).mask("<0!8 1!48 0!8>"),
  chord("<Am F C G>").voicing().s("sawtooth").lpf(1600).attack(.2).release(.6).room(.6).gain(.12)
    .mask("<0!24 1!32 0!8>")
)._pianoroll()
$: s("<~!32 white@8 ~!24>").lpf(150).lpattack(13).lpenv(7).lpsustain(1).attack(10).sustain(1)
  .release(.02).gain(.3)`
  },
  {
    id: 'harbour-steps',
    label: 'Harbour Steps (dub)',
    code: `// Harbour Steps: a dub song in G minor
// Thirty-two bars: intro, riddim, drop out, riddim, outro. Each string holds one number a bar.
setcpm(75/4)

$: s("~ ~ bd ~, hh*8").bank("RolandTR808").gain(.5).mask("<1!16 0!2 1!14>")._punchcard()
$: s("~ ~ rm ~").gain(.4).delay(.5).delaytime(.3).delayfeedback(.5).mask("<0!4 1!28>")
$: note("<[g2 ~ g2 bb2] [c3 ~ bb2 g2] [g2 ~ d2 f2] [d2 ~ ~ ~]>").s("triangle").lpf(300).shape(.3)
  .decay(.5).sustain(.3).postgain(.8).mask("<0!4 1!10 0!4 1!10 0!4>")._scope()
$: stack(
  chord("<Gm Cm Gm D7>").voicing().struct("~ x ~ x").s("square").lpf(1800).decay(.1).sustain(0)
    .delay(.5).delaytime(.4).delayfeedback(.55).room(.3).gain(.28),
  n("<[~ 4 ~ 3] [2 ~ ~ ~] [~ 4 ~ 6] [4 ~ ~ ~]>").scale("G4:minor").s("gm_accordion")
    .delay(.4).delaytime(.4).delayfeedback(.5).room(.4).gain(.4).mask("<0!8 1!8 0!16>")
)`
  },
  {
    id: 'wire-fence',
    label: 'Wire Fence (breakbeat)',
    code: `// Wire Fence: a breakbeat song in E minor
// Forty-eight bars: intro, verse, breakdown, verse, outro. Each string holds one number a bar.
setcpm(130/4)

$: s("breaks125").fit().gain(.75).chop(16).mask("<1!28 0!4 1!16>")._punchcard()
$: note("<[e1 ~ e2 ~ ~ e1 ~ g1] [e1 ~ e2 ~ ~ d2 ~ b1] [c2 ~ c3 ~ ~ c2 ~ d2] [b1 ~ b2 ~ ~ b1 ~ d2]>")
  .s("sawtooth").lpf(600).decay(.2).sustain(.2).gain(.65).mask("<0!4 1!40 0!4>")._scope()
$: s("~ cp ~ cp").gain(.45).mask("<0!8 1!20 0!4 1!12 0!4>")
$: s("perc(5,8)").hpf(500).gain(.5).pan(sine.range(.3, .7).slow(4)).mask("<0!12 1!36>")`
  },
  {
    id: 'neon-drive',
    label: 'Neon Drive (synthwave)',
    code: `// Neon Drive: a synthwave song in A minor
// Forty-eight bars: chords alone, verse, chorus, chords alone. One number a bar.
setcpm(100/4)

$: chord("<Am F C G>").voicing().s("sawtooth").lpf("<700!8 1800!32 700!8>")
  .decay(.3).sustain(0).gain(.22).room(.3)._pianoroll()
$: s("bd*4, ~ cp ~ cp, [~ hh]*4").bank("RolandTR909").gain(.44)
  .mask("<0!8 1!32 0!8>")
$: note("<a1 a1 c2 g1>").s("sawtooth").lpf(500).decay(.18).sustain(0).gain(.7)
  .mask("<0!8 1!32 0!8>")
$: n("<0 2 4 7 4 2 0 2>").scale("A3:minor").s("triangle").delay(.3).delaytime(.375)
  .delayfeedback(.35).gain(.31).mask("<0!24 1!16 0!8>")._spectrum()`
  },
  {
    id: 'dust-and-diesel',
    label: 'Dust and Diesel (stoner rock)',
    code: `// Dust and Diesel: a stoner rock song in D minor
// Forty-eight bars: riff, verse, chorus, riff. One number a bar.
setcpm(80/4)

$: chord("<Dm Bb C G>").voicing().s("gm_overdriven_guitar").lpf("<900!8 1600!32 900!8>")
  .decay(.2).sustain(0).gain(.26).room(.25)._punchcard()
$: s("bd ~ ~ bd ~ ~ bd ~, ~ ~ sd ~ ~ ~ sd ~, hh*8").gain(.38)
  .mask("<0!8 1!32 0!8>")
$: note("<d2 d2 f2 g2>").s("sawtooth").lpf(350).decay(.3).sustain(0).gain(.78)
  .mask("<0!8 1!32 0!8>")._scope()
$: note("<d4 f4 g4 a4>").s("gm_overdriven_guitar").gain(.33)
  .mask("<0!24 1!16 0!8>")`
  },
  {
    id: 'rust-and-rain',
    label: 'Rust and Rain (grunge)',
    code: `// Rust and Rain: a grunge song in E minor
// Forty bars: quiet verse, loud chorus, bridge, chorus. One number a bar.
setcpm(120/4)

$: chord("<Em G D A>").voicing().s("gm_overdriven_guitar").lpf(1200).decay(.15).sustain(0)
  .gain("<.11!8 .28!16 .18!8 .28!8>").room(.2)._punchcard()
$: s("bd ~ bd ~ bd ~ ~ ~, ~ ~ sd ~ ~ ~ sd ~, hh*8").gain("<.22!8 .5!32>")
  .mask("<1!40>")
$: note("<e2 e2 g2 d2>").s("sawtooth").lpf(500).decay(.2).sustain(0)
  .gain("<.45!8 .8!32>").mask("<1!40>")._scope()
$: note("<e4 g4 a4 b4>").s("gm_overdriven_guitar").gain(.32)
  .mask("<0!8 1!16 0!8 1!8>")`
  },
  {
    id: 'winter-court',
    label: 'Winter Court (classical)',
    code: `// Winter Court: a classical piece in D minor
// Thirty-two bars: theme, development, return, coda. One number a bar.
setcpm(80/4)

$: chord("<Dm Bb F C>").voicing().s("gm_string_ensemble_1").attack(.4).release(1.2)
  .gain(.35).room(.4)._pianoroll()
$: n("<0 2 4 7 4 2 0 -1>").scale("D4:minor").s("gm_violin").gain(.48)
  .mask("<1!24 0!8>")._spiral()
$: note("<d2 d2 bb1 a1>").s("gm_cello").gain(.56).mask("<1!32>")
$: s("perc(3,8)").hpf(80).gain(.38).mask("<0!8 1!8 0!8 1!8>")`
  },
  {
    id: 'uptown-strut',
    label: 'Uptown Strut (funk)',
    code: `// Uptown Strut: a funk song in E minor
// Forty-eight bars: intro, verse, chorus, break. One number a bar.
setcpm(105/4)

$: stack(
  s("bd ~ ~ bd ~ ~ bd ~"),
  s("~ ~ sd ~ ~ sd ~ ~"),
  s("hh*8").gain(.6),
  s("perc(5,8)").hpf(600).gain(.4)
).gain("<.4!8 .52!40>").mask("<1!48>")._punchcard()
$: note("<e2 ~ e2 g2 ~ a2 ~ b2>").s("sawtooth").lpf(700).decay(.12).sustain(0).gain(.72)
  .mask("<0!8 1!32 0!8>")
$: chord("<E7 A7 D7 B7>").voicing().struct("~ x ~ x").s("gm_overdriven_guitar")
  .decay(.08).sustain(0).gain(.2).mask("<0!16 1!24 0!8>")._pianoroll()
$: n("<0 3 5 6 7 6 5 3>").scale("E3:minor:pentatonic").s("gm_brass_section").gain(.25)
  .mask("<0!24 1!16 0!8>")`
  },
  {
    id: 'blue-hour',
    label: 'Blue Hour (jazz)',
    code: `// Blue Hour: a jazz song in Bb major
// Thirty-two bars: head, solo, head. One number a bar.
setcpm(130/4)

$: stack(
  s("~ ~ bd ~ ~ ~ bd ~").gain(.25),
  s("~ ~ sd ~ ~ ~ sd ~").gain(.2),
  s("hh*8").gain(.55)
).swingBy(1/3, 4).mask("<1!32>")
$: note("<c2 e2 g2 a2>").s("gm_acoustic_bass").gain(.55).mask("<1!32>")
$: chord("<Cm7 F7 Bb^7 Eb^7>").voicing().s("gm_epiano1").gain(.3)
  .mask("<1!32>")._pianoroll()
$: n("<0 2 4 5 7 9 7 4>").scale("Bb3:major").s("gm_vibraphone").gain(.35)
  .mask("<1!16 0!8 1!8>")._pitchwheel()`
  }
]

export const DEFAULT_STRUDEL_EXAMPLE_ID = 'first-beat'
/** Where the code on screen is kept between visits. */
export const STRUDEL_SAVED_CODE_STORAGE_KEY = 'strudel-editor-code'
/** Where the patterns saved under a name are kept. */
export const STRUDEL_SAVED_PATTERNS_STORAGE_KEY = 'strudel-editor-saved-patterns'
/** Starts every saved pattern's anchor, so none can collide with an example's or a tune's. */
export const STRUDEL_SAVED_PATTERN_ID_PREFIX = 'saved-'
/** The anchor of a saved pattern whose name has no letters or digits to make one from. */
export const STRUDEL_SAVED_PATTERN_FALLBACK_SLUG = 'pattern'

/**
 * Every bank strudel.cc preloads, plus dirt-samples, which the shipped examples play. Loaded
 * once, before the first evaluation, or every trigger fails with "sound not found". The lists
 * download together but register in this order, and a later bank wins a name two banks share:
 * dirt-samples is last, so `bd`, `sd`, `hh` and the other names it shares with the uzu drum kit
 * stay the kit the examples were written for. The CDN folders are the ones strudel.cc reads
 * from, faster than the GitHub folders the manifests name.
 */
export const STRUDEL_SAMPLE_BANKS: StrudelSampleBank[] = [
  {
    label: 'Piano',
    manifestUrl: 'https://strudel.b-cdn.net/piano.json',
    baseUrl: 'https://strudel.b-cdn.net/piano/'
  },
  {
    label: 'VCSL instruments',
    manifestUrl: 'https://strudel.b-cdn.net/vcsl.json',
    baseUrl: 'https://strudel.b-cdn.net/VCSL/'
  },
  {
    label: 'Drum machines',
    manifestUrl: 'https://strudel.b-cdn.net/tidal-drum-machines.json',
    baseUrl: 'https://strudel.b-cdn.net/tidal-drum-machines/machines/',
    tag: 'drum-machines',
    groupsByMachine: true
  },
  {
    label: 'Uzu drum kit',
    manifestUrl: 'https://strudel.b-cdn.net/uzu-drumkit.json',
    baseUrl: 'https://strudel.b-cdn.net/uzu-drumkit/',
    tag: 'drum-machines'
  },
  {
    label: 'Wavetables',
    manifestUrl: 'https://strudel.b-cdn.net/uzu-wavetables.json',
    baseUrl: 'https://strudel.b-cdn.net/uzu-wavetables/',
    namePrefix: 'wt_'
  },
  {
    label: 'Mridangam',
    manifestUrl: 'https://strudel.b-cdn.net/mridangam.json',
    baseUrl: 'https://strudel.b-cdn.net/mrid/',
    tag: 'drum-machines',
    namePrefix: 'mridangam_'
  },
  {
    label: 'Dirt samples',
    manifestUrl: 'https://raw.githubusercontent.com/tidalcycles/dirt-samples/main/strudel.json',
    baseUrl: 'https://raw.githubusercontent.com/tidalcycles/dirt-samples/main/'
  }
]

/** The sounds tab's filters, the ones strudel.cc's sounds tab offers. */
export const STRUDEL_SOUND_FILTERS: { id: StrudelSoundFilter; label: string }[] = [
  { id: 'all', label: 'all' },
  { id: 'samples', label: 'samples' },
  { id: 'drum-machines', label: 'drum machines' },
  { id: 'synths', label: 'synths' },
  { id: 'wavetables', label: 'wavetables' }
]

/** The tag strudel.cc gives drum machine banks, which the filters split from other samples. */
export const STRUDEL_DRUM_MACHINES_TAG = 'drum-machines'

/**
 * What the drum abbreviations stand for, as the sounds tab names them. A drum machine sound is
 * named after its part (`RolandTR909_bd`), and so is a plain kit sample (`bd`, `808bd`).
 */
export const STRUDEL_DRUM_PART_NAMES: Record<string, string> = {
  bd: 'bass drum',
  sd: 'snare drum',
  hh: 'closed hi-hat',
  oh: 'open hi-hat',
  cp: 'clap',
  rim: 'rimshot',
  lt: 'low tom',
  mt: 'mid tom',
  ht: 'high tom',
  cr: 'crash',
  rd: 'ride',
  cb: 'cowbell',
  sh: 'shaker',
  tb: 'tambourine',
  perc: 'percussion',
  misc: 'miscellaneous',
  fx: 'effects',
  brk: 'breakbeat'
}

/** The sixteen General MIDI families, eight programs each, that group the `gm_*` soundfonts. */
export const STRUDEL_GENERAL_MIDI_FAMILIES = [
  'Pianos',
  'Chromatic percussion',
  'Organs',
  'Guitars',
  'Basses',
  'Strings',
  'Ensembles',
  'Brass',
  'Reeds',
  'Pipes',
  'Synth leads',
  'Synth pads',
  'Synth effects',
  'World instruments',
  'Percussive',
  'Sound effects'
]

/** General MIDI programs per family; a soundfont's family is its program divided by this. */
export const STRUDEL_GENERAL_MIDI_FAMILY_SIZE = 8

/** The group of the built-in oscillators and noise, which come from no sample bank. */
export const STRUDEL_SYNTHS_GROUP_LABEL = 'Synths'

/** How long a sound plays when its name is clicked in the sounds tab, in seconds. */
export const STRUDEL_SOUND_PREVIEW_SECONDS = 0.5

/** The note a synth or soundfont previews at, A3, since unlike a sample it has no pitch of its own. */
export const STRUDEL_SOUND_PREVIEW_NOTE = 57

/** Lead time before a preview starts, so the first scheduled sample is not clipped. */
export const STRUDEL_SOUND_PREVIEW_LEAD_SECONDS = 0.05

/** Short names such as `.bank("TR909")` for the drum machines, applied once they are loaded. */
export const STRUDEL_BANK_ALIASES_URL = 'https://strudel.b-cdn.net/tidal-drum-machines-alias.json'

/** Strudel's own tempo before a pattern sets one: one cycle every two seconds. */
export const DEFAULT_CPS = 0.5

/** One cycle by default: a sound effect or a single bar, played once. */
export const EXPORT_DEFAULT_OPTIONS: StrudelExportOptions = {
  format: 'wav',
  startCycle: 0,
  endCycle: 1,
  sampleRate: 48000,
  fileName: ''
}
/** The finest repetition the export looks for: a sound played up to sixteen times a cycle. */
export const STRUDEL_MAX_REPETITIONS_PER_CYCLE = 16
/** The longest loop the timeline looks for, in bars; a pattern that has not repeated by then shows this many. */
export const STRUDEL_TIMELINE_MAX_LOOP_BARS = 16
/** The finest point the timeline seeks to: a sixteenth of a bar. */
export const STRUDEL_TIMELINE_SEEK_STEP = 0.0625
export const EXPORT_FORMAT_OPTIONS = [
  { value: 'wav', label: 'WAV' },
  { value: 'midi', label: 'MIDI' }
]
/** General MIDI percussion keys for the drum sample names Strudel's banks share. */
export const STRUDEL_DRUM_MIDI_NOTES: Record<string, number> = {
  bd: 36,
  rim: 37,
  sd: 38,
  cp: 39,
  lt: 41,
  hh: 42,
  mt: 45,
  oh: 46,
  ht: 48,
  cr: 49,
  rd: 51,
  cb: 56,
  sh: 70
}
/** MIDI channel 10, counted from zero as files store it, is percussion in General MIDI. */
export const MIDI_DRUM_CHANNEL = 9
/** Strudel counts a cycle as one bar of four beats, which `setcpm(bpm / 4)` assumes too. */
export const STRUDEL_BEATS_PER_CYCLE = 4
export const STRUDEL_EXPORT_DEFAULT_VELOCITY = 0.8
export const EXPORT_SAMPLE_RATE_OPTIONS = [
  { value: '44100', label: '44.1 kHz' },
  { value: '48000', label: '48 kHz' },
  { value: '96000', label: '96 kHz' }
]

/** How long typing or a canvas edit settles before the code and the graph follow each other. */
export const FLOW_SYNC_DELAY_MS = 300

export const STRUDEL_TABS: { id: StrudelTabId; label: string }[] = [
  { id: 'import', label: 'Import' },
  { id: 'export', label: 'Export' },
  { id: 'midi', label: 'MIDI' },
  { id: 'sounds', label: 'Sounds' },
  { id: 'console', label: 'Console' },
  { id: 'settings', label: 'Settings' },
  { id: 'flow', label: 'Nodes' },
  { id: 'hints', label: 'Hints' }
]

/** Analysis runs on mono audio resampled to this rate; it keeps hi-hats below Nyquist. */
export const TRANSCRIPTION_SAMPLE_RATE = 22050
export const TRANSCRIPTION_MAX_SECONDS = 90
export const TRANSCRIPTION_MAX_BARS = 64
export const TRANSCRIPTION_ACCEPTED_TYPES =
  'audio/*,.mp3,.wav,.ogg,.m4a,.flac,.mid,.midi,image/png,image/jpeg,image/webp'
/** A screenshot larger than this is refused, since every pixel is held in memory twice. */
export const TAB_IMAGE_MAX_PIXELS = 16000000

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

export const MIDI_DEFAULT_BEATS_PER_MINUTE = 120
/** General MIDI percussion keys folded onto the three drums the transcription writes. */
export const MIDI_DRUM_SOUNDS: Record<number, DrumSound> = {
  35: 'bd',
  36: 'bd',
  37: 'sd',
  38: 'sd',
  39: 'sd',
  40: 'sd',
  42: 'hh',
  44: 'hh',
  46: 'hh'
}

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
/** The documentation beside the completion list: twice CodeMirror's 400px default. */
export const STRUDEL_COMPLETION_INFO_MAX_WIDTH = 800
/** How far in from the list's left edge the documentation sits when it drops under the list. */
export const STRUDEL_COMPLETION_INFO_MARGIN = 30
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

/** Strudel plays a cycle every two seconds until told otherwise: 120 BPM at four beats a cycle. */
export const STRUDEL_DEFAULT_BEATS_PER_MINUTE = 120
/** The hints tab's picker value for "take the style from the comment or the code". */
export const STRUDEL_STYLE_PICKER_DETECT = 'detect'

/**
 * Each style's usual tempo, the instruments it is built from and the visuals that suit it.
 * Snippets use only the dirt-samples kit the editor loads and Strudel's built-in synths.
 */
export const STRUDEL_MUSIC_STYLES: StrudelMusicStyle[] = [
  {
    id: 'techno',
    label: 'Techno',
    keywords: ['techno', 'minimal techno', 'acid techno'],
    definingRoles: ['kick'],
    minBeatsPerMinute: 125,
    maxBeatsPerMinute: 140,
    beatsPerMinute: 130,
    instruments: [
      {
        role: 'kick',
        label: 'a four-on-the-floor kick',
        snippet: 's("bd*4").gain(.5)',
        reason: 'Techno is built on a kick on every beat; everything else hangs off it.'
      },
      {
        role: 'hihat',
        label: 'offbeat hi-hats',
        snippet: 's("[~ hh]*4").gain(1.5)',
        reason: 'Hats between the kicks give the groove its push.'
      },
      {
        role: 'clap',
        label: 'a clap on two and four',
        snippet: 's("~ cp ~ cp").gain(.4)',
        reason: 'A clap on the backbeat answers the kick.'
      },
      {
        role: 'bass',
        label: 'a rolling bass',
        snippet: 'note("[~ c2 c2 c2]*4").s("sawtooth").lpf(500).decay(.12).sustain(0).gain(1.2)',
        reason: 'Short notes between the kicks roll under them without fighting them.'
      },
      {
        role: 'percussion',
        label: 'syncopated percussion',
        snippet: 's("perc(3,8)").hpf(500).gain(.6)',
        reason:
          'An off-grid line keeps a long loop from going flat; the filter leaves the low end to the kick.'
      }
    ],
    visuals: ['punchcard', 'scope']
  },
  {
    id: 'house',
    label: 'House',
    keywords: ['house', 'deep house', 'tech house', 'garage'],
    definingRoles: ['kick'],
    minBeatsPerMinute: 118,
    maxBeatsPerMinute: 128,
    beatsPerMinute: 124,
    instruments: [
      {
        role: 'kick',
        label: 'a four-on-the-floor kick',
        snippet: 's("bd*4").gain(.5)',
        reason: 'House runs on a steady kick on every beat.'
      },
      {
        role: 'hihat',
        label: 'offbeat hi-hats',
        snippet: 's("[~ hh]*4").gain(1.5)',
        reason: 'The offbeat hat is the swing that makes house move.'
      },
      {
        role: 'clap',
        label: 'a clap on two and four',
        snippet: 's("~ cp ~ cp").gain(.4)',
        reason: 'A clap on the backbeat is the other half of the house groove.'
      },
      {
        role: 'bass',
        label: 'a bassline',
        snippet:
          'note("[~ c2] [~ c2] [~ eb2] [~ f2]").s("sawtooth").lpf(600).decay(.2).sustain(0).gain(1.2)',
        reason:
          'A short, moving bass on the offbeats carries the harmony and leaves room for the kick.'
      },
      {
        role: 'chords',
        label: 'warm chords',
        snippet: 'chord("<Cm7 Fm7>").voicing().s("triangle").gain(.4)',
        reason: 'Seventh chords give house its warmth.'
      }
    ],
    visuals: ['punchcard', 'pianoroll']
  },
  {
    id: 'drum-and-bass',
    label: 'Drum and bass',
    keywords: [
      'drum and bass',
      'drum & bass',
      'drum n bass',
      "drum'n'bass",
      'dnb',
      'd&b',
      'jungle'
    ],
    definingRoles: ['kick', 'snare'],
    minBeatsPerMinute: 165,
    maxBeatsPerMinute: 178,
    beatsPerMinute: 174,
    instruments: [
      {
        role: 'kick',
        label: 'a two-step kick',
        snippet: 's("bd ~ ~ ~ ~ bd ~ ~").gain(.45)',
        reason: 'The kick on one and the and of three sets up the two-step.'
      },
      {
        role: 'snare',
        label: 'a snare on two and four',
        snippet: 's("~ ~ sd ~ ~ ~ sd ~").gain(.35)',
        reason: 'The backbeat snare is what makes the tempo feel half as fast as it is.'
      },
      {
        role: 'hihat',
        label: 'fast hi-hats',
        snippet: 's("hh*8").gain(1.2)',
        reason: 'Steady hats keep the double-time energy.'
      },
      {
        role: 'bass',
        label: 'a sub bass',
        snippet: 'note("<c2 c2 g1 eb2>").s("sine").shape(.8).postgain(.2)',
        reason:
          'A deep sub is the "bass" half of drum and bass; saturation adds the harmonics that let small speakers carry it.'
      }
    ],
    visuals: ['scope', 'spectrum']
  },
  {
    id: 'hip-hop',
    label: 'Hip hop',
    keywords: ['hip hop', 'hip-hop', 'hiphop', 'boom bap', 'boombap', 'rap', 'lofi', 'lo-fi'],
    definingRoles: ['kick', 'snare'],
    minBeatsPerMinute: 80,
    maxBeatsPerMinute: 100,
    beatsPerMinute: 90,
    instruments: [
      {
        role: 'kick',
        label: 'a boom-bap kick',
        snippet: 's("bd ~ ~ bd ~ bd ~ ~").gain(.45)',
        reason: 'A loose, syncopated kick is the "boom".'
      },
      {
        role: 'snare',
        label: 'a snare on two and four',
        snippet: 's("~ ~ sd ~ ~ ~ sd ~").gain(.35)',
        reason: 'The backbeat snare is the "bap".'
      },
      {
        role: 'hihat',
        label: 'eighth-note hi-hats',
        snippet: 's("hh*8").gain(1.2)',
        reason: 'Steady hats hold a slow beat together.'
      },
      {
        role: 'chords',
        label: 'jazzy chords',
        snippet: 'chord("<Cm7 Ab^7>").voicing().s("triangle").gain(.3)',
        reason: 'Sampled-sounding seventh chords are the classic hip hop bed.'
      },
      {
        role: 'bass',
        label: 'a bassline',
        snippet:
          'note("<[c2 ~ ~ c2 ~ eb2 ~ ~] [ab1 ~ ~ ab1 ~ c2 ~ ~]>").s("triangle").shape(.3).postgain(.45)',
        reason: 'A sparse bass follows the kick and the chords, and fills the bottom.'
      }
    ],
    visuals: ['punchcard', 'pianoroll']
  },
  {
    id: 'ambient',
    label: 'Ambient',
    keywords: ['ambient', 'drone', 'chill', 'chillout', 'downtempo', 'meditation'],
    definingRoles: ['chords'],
    minBeatsPerMinute: 60,
    maxBeatsPerMinute: 90,
    beatsPerMinute: 70,
    instruments: [
      {
        role: 'chords',
        label: 'slow chords',
        snippet:
          'chord("<C^7 Am7 F^7 G7>").voicing().s("triangle").slow(2).attack(1).release(2).room(.8).gain(.2)',
        reason: 'Long chords that fade in and out are the body of ambient music.'
      },
      {
        role: 'melody',
        label: 'a sparse melody',
        snippet: 'n("0 ~ 4 ~ 7 ~ 4 ~").scale("C:major").s("sine").slow(2).delay(.5)',
        reason: 'A few notes with echo give the ear something to follow.'
      },
      {
        role: 'bass',
        label: 'a drone bass',
        snippet:
          'note("<c2 a2 f2 g2>").s("sine").shape(.5).postgain(.3).slow(2).attack(1).release(2)',
        reason: 'A low, slow root note anchors the chords.'
      }
    ],
    visuals: ['spiral', 'spectrum']
  },
  {
    id: 'trance',
    label: 'Trance',
    keywords: ['trance', 'psytrance', 'psy trance', 'uplifting'],
    definingRoles: ['kick'],
    minBeatsPerMinute: 130,
    maxBeatsPerMinute: 145,
    beatsPerMinute: 138,
    instruments: [
      {
        role: 'kick',
        label: 'a four-on-the-floor kick',
        snippet: 's("bd*4").gain(.5)',
        reason: 'Trance keeps a kick on every beat.'
      },
      {
        role: 'hihat',
        label: 'offbeat hi-hats',
        snippet: 's("[~ hh]*4").gain(1.5)',
        reason: 'The offbeat hat drives the build.'
      },
      {
        role: 'bass',
        label: 'an offbeat rolling bass',
        snippet: 'note("[~ a1]*4").s("sawtooth").lpf(800).decay(.15).sustain(0).gain(1.2)',
        reason: 'A short bass between the kicks gives trance its rolling feel.'
      },
      {
        role: 'melody',
        label: 'an arpeggiated lead',
        snippet:
          'n("0 2 4 7 4 2 0 2").fast(2).scale("A:minor").s("sawtooth").lpf(2000).decay(.15).sustain(0).gain(.6)',
        reason: 'A fast arpeggio is the hook trance is known for.'
      }
    ],
    visuals: ['pianoroll', 'spectrum']
  },
  {
    id: 'dub',
    label: 'Dub',
    keywords: ['dub', 'reggae', 'roots'],
    definingRoles: ['kick', 'bass'],
    minBeatsPerMinute: 65,
    maxBeatsPerMinute: 85,
    beatsPerMinute: 75,
    instruments: [
      {
        role: 'kick',
        label: 'a one-drop kick',
        snippet: 's("~ ~ bd ~").gain(.4)',
        reason: 'The one drop leaves the first beat empty and lands on the third.'
      },
      {
        role: 'clap',
        label: 'a rimshot with the drop',
        snippet: 's("~ ~ rm ~").gain(.3)',
        reason: 'A rim on the same beat as the kick marks the drop.'
      },
      {
        role: 'bass',
        label: 'a heavy bassline',
        snippet:
          'note("<[c2 ~ c2 eb2] [f2 ~ eb2 c2]>").s("triangle").lpf(300).shape(.3).postgain(.5)',
        reason: 'Dub is led by a deep, round bass that moves with the chords.'
      },
      {
        role: 'chords',
        label: 'an offbeat skank',
        snippet:
          'chord("<Cm Fm>").voicing().struct("~ x ~ x").s("square").decay(.12).sustain(0).gain(.3).delay(.5)',
        reason: 'Short chords on the offbeat, echoed, are the skank.'
      }
    ],
    visuals: ['scope', 'punchcard']
  },
  {
    id: 'breakbeat',
    label: 'Breakbeat',
    keywords: ['breakbeat', 'breaks', 'big beat', 'nu skool'],
    definingRoles: ['breaks'],
    minBeatsPerMinute: 120,
    maxBeatsPerMinute: 140,
    beatsPerMinute: 130,
    instruments: [
      {
        role: 'breaks',
        label: 'a sampled break',
        snippet: 's("breaks125").fit().gain(.6)',
        reason: 'A chopped drum break, not a drum machine, is what defines breakbeat.'
      },
      {
        role: 'bass',
        label: 'a bassline',
        snippet: 'note("<c2 eb2>*2").s("sawtooth").lpf(500).decay(.3).sustain(0).gain(1.2)',
        reason: 'A gritty bass rides on top of the break.'
      },
      {
        role: 'clap',
        label: 'a clap on two and four',
        snippet: 's("~ cp ~ cp").gain(.4)',
        reason: 'A clap on the backbeat reinforces the break.'
      },
      {
        role: 'percussion',
        label: 'extra percussion',
        snippet: 's("perc(5,8)").hpf(500).gain(.6)',
        reason:
          'Percussion on top fills the gaps in the break; the filter leaves the low end to it.'
      }
    ],
    visuals: ['punchcard', 'scope']
  },
  {
    id: 'synthwave',
    label: 'Synthwave',
    keywords: ['synthwave', 'synth wave', 'retrowave', 'outrun', '80s synth'],
    definingRoles: ['kick', 'bass'],
    minBeatsPerMinute: 80,
    maxBeatsPerMinute: 105,
    beatsPerMinute: 100,
    instruments: [
      {
        role: 'kick',
        label: 'a four-on-the-floor kick',
        snippet: 's("bd*4").gain(.5)',
        reason: 'A steady kick drives the night-drive pulse.'
      },
      {
        role: 'clap',
        label: 'a gated clap on two and four',
        snippet: 's("~ cp ~ cp").gain(.4)',
        reason: 'A wide 80s clap answers the kick on the backbeat.'
      },
      {
        role: 'hihat',
        label: 'offbeat hi-hats',
        snippet: 's("[~ hh]*4").gain(1.2)',
        reason: 'Hats between the kicks keep the arpeggio moving.'
      },
      {
        role: 'bass',
        label: 'a driving octave bass',
        snippet: 'note("<a1 a1 c2 g1>").s("sawtooth").lpf(500).decay(.18).sustain(0).gain(1.1)',
        reason: 'A short saw bass under the chords carries the low end.'
      },
      {
        role: 'chords',
        label: 'wide minor chords',
        snippet:
          'chord("<Am F C G>").voicing().s("sawtooth").lpf(1800).decay(.3).sustain(0).gain(.3)',
        reason: 'Open minor chords give synthwave its nostalgic lift.'
      },
      {
        role: 'melody',
        label: 'an arpeggiated lead',
        snippet: 'n("<0 2 4 7 4 2>").scale("A3:minor").s("triangle").delay(.3).gain(.35)',
        reason: 'A repeating arpeggio is the hook over the chord bed.'
      }
    ],
    visuals: ['pianoroll', 'spectrum']
  },
  {
    id: 'stoner-rock',
    label: 'Stoner rock',
    keywords: ['stoner rock', 'stoner', 'desert rock', 'fuzz rock', 'sludge'],
    definingRoles: ['bass', 'chords'],
    minBeatsPerMinute: 65,
    maxBeatsPerMinute: 100,
    beatsPerMinute: 80,
    instruments: [
      {
        role: 'kick',
        label: 'a heavy syncopated kick',
        snippet: 's("bd ~ ~ bd ~ ~ bd ~").gain(.6)',
        reason: 'A loose, heavy kick leaves room around the riff.'
      },
      {
        role: 'snare',
        label: 'a backbeat snare',
        snippet: 's("~ ~ sd ~ ~ ~ sd ~").gain(.5)',
        reason: 'The snare on two and four keeps the slow riff from dragging.'
      },
      {
        role: 'hihat',
        label: 'steady eighth-note hi-hats',
        snippet: 's("hh*8").gain(1.1)',
        reason: 'Steady hats hold the tempo under the fuzz.'
      },
      {
        role: 'bass',
        label: 'a fuzz bass',
        snippet: 'note("<d2 d2 f2 g2>").s("sawtooth").lpf(350).decay(.3).sustain(0).gain(1.2)',
        reason: 'A dark, short bass locks with the kick and the riff.'
      },
      {
        role: 'chords',
        label: 'fuzz guitar chords',
        snippet:
          'chord("<Dm Bb C G>").voicing().s("gm_overdriven_guitar").lpf(1400).decay(.2).sustain(0).gain(.35)',
        reason: 'Overdriven chords are the wall the style is built on.'
      },
      {
        role: 'melody',
        label: 'a pentatonic lead',
        snippet: 'note("<d3 f3 g3 a3>").s("gm_overdriven_guitar").gain(.5)',
        reason: 'A short modal lead answers the riff without leaving the key.'
      }
    ],
    visuals: ['punchcard', 'scope']
  },
  {
    id: 'grunge',
    label: 'Grunge',
    keywords: ['grunge', 'seattle sound', '90s rock'],
    definingRoles: ['kick', 'snare', 'chords'],
    minBeatsPerMinute: 100,
    maxBeatsPerMinute: 125,
    beatsPerMinute: 120,
    instruments: [
      {
        role: 'kick',
        label: 'a driving kick',
        snippet: 's("bd ~ bd ~ bd ~ ~ ~").gain(.6)',
        reason: 'A pushy kick keeps the quiet verse moving.'
      },
      {
        role: 'snare',
        label: 'a hard backbeat snare',
        snippet: 's("~ ~ sd ~ ~ ~ sd ~").gain(.55)',
        reason: 'The snare on two and four is the loud half of the quiet-loud turn.'
      },
      {
        role: 'hihat',
        label: 'eighth-note hi-hats',
        snippet: 's("hh*8").gain(1.1)',
        reason: 'Hats fill the space between the heavy hits.'
      },
      {
        role: 'bass',
        label: 'a distorted bass',
        snippet: 'note("<e2 e2 g2 d2>").s("sawtooth").lpf(500).decay(.2).sustain(0).gain(1.1)',
        reason: 'A short, dirty bass follows the guitar chords.'
      },
      {
        role: 'chords',
        label: 'overdriven guitar chords',
        snippet:
          'chord("<Em G D A>").voicing().s("gm_overdriven_guitar").lpf(1200).decay(.15).sustain(0).gain(.4)',
        reason: 'A distorted chord progression carries the quiet-loud dynamics.'
      },
      {
        role: 'melody',
        label: 'a shouted guitar hook',
        snippet: 'note("<e4 g4 a4 b4>").s("gm_overdriven_guitar").gain(.45)',
        reason: 'A simple repeated hook sits above the wall of chords.'
      }
    ],
    visuals: ['punchcard', 'scope']
  },
  {
    id: 'classical',
    label: 'Classical',
    keywords: ['classical', 'orchestral', 'baroque', 'romantic', 'chamber music'],
    definingRoles: ['chords', 'melody', 'bass'],
    minBeatsPerMinute: 60,
    maxBeatsPerMinute: 100,
    beatsPerMinute: 80,
    instruments: [
      {
        role: 'chords',
        label: 'a string section',
        snippet:
          'chord("<Dm Bb F C>").voicing().s("gm_string_ensemble_1").attack(.4).release(1.2).gain(.3)',
        reason: 'Sustained strings are the body of a classical arrangement.'
      },
      {
        role: 'melody',
        label: 'a violin melody',
        snippet: 'n("<0 2 4 7 4 2>").scale("D4:minor").s("gm_violin").gain(.4)',
        reason: 'A singing upper line carries the theme.'
      },
      {
        role: 'bass',
        label: 'a cello bass',
        snippet: 'note("<d2 d2 bb1 a1>").s("gm_cello").gain(.5)',
        reason: 'The cello anchors the harmony below the strings.'
      },
      {
        role: 'percussion',
        label: 'timpani hits',
        snippet: 's("perc(3,8)").hpf(80).gain(.35)',
        reason: 'A few low hits mark the returns without turning into a drum kit.'
      }
    ],
    visuals: ['pianoroll', 'spiral']
  },
  {
    id: 'funk',
    label: 'Funk',
    keywords: ['funk', 'funky', 'p-funk', 'boogie'],
    definingRoles: ['bass', 'chords', 'percussion'],
    minBeatsPerMinute: 95,
    maxBeatsPerMinute: 120,
    beatsPerMinute: 105,
    instruments: [
      {
        role: 'kick',
        label: 'a syncopated kick',
        snippet: 's("bd ~ ~ bd ~ ~ bd ~").gain(.55)',
        reason: 'The kick lands around the beat, not only on it.'
      },
      {
        role: 'snare',
        label: 'a snare with ghost notes',
        snippet: 's("~ ~ sd ~ ~ sd ~ ~").gain(.5)',
        reason: 'A backbeat with extra taps is the funk pocket.'
      },
      {
        role: 'hihat',
        label: 'tight eighth-note hi-hats',
        snippet: 's("hh*8").gain(1.2)',
        reason: 'Tight hats keep the sixteenth-note feel readable.'
      },
      {
        role: 'percussion',
        label: 'hand percussion',
        snippet: 's("perc(5,8)").hpf(600).gain(.5)',
        reason: 'A shaker or conga line adds the upper rhythm.'
      },
      {
        role: 'bass',
        label: 'a slap bass',
        snippet:
          'note("<e2 ~ e2 g2 ~ a2 ~ b2>").s("sawtooth").lpf(700).decay(.12).sustain(0).gain(1.1)',
        reason: 'Short, popping bass notes are the lead voice of funk.'
      },
      {
        role: 'chords',
        label: 'scratch guitar chords',
        snippet:
          'chord("<E7 A7 D7 B7>").voicing().struct("~ x ~ x").s("gm_overdriven_guitar").decay(.08).sustain(0).gain(.25)',
        reason: 'Tight offbeat chords chop against the bass.'
      },
      {
        role: 'melody',
        label: 'a brass stab',
        snippet:
          'n("<0 3 5 6 7 6 5 3>").scale("E3:minor:pentatonic").s("gm_brass_section").gain(.35)',
        reason: 'A short horn line answers the vocal space.'
      }
    ],
    visuals: ['punchcard', 'pianoroll']
  },
  {
    id: 'jazz',
    label: 'Jazz',
    keywords: ['jazz', 'bebop', 'swing', 'bossa nova', 'fusion'],
    definingRoles: ['bass', 'chords', 'melody'],
    minBeatsPerMinute: 126,
    maxBeatsPerMinute: 170,
    beatsPerMinute: 130,
    instruments: [
      {
        role: 'kick',
        label: 'a feathered kick',
        snippet: 's("~ ~ bd ~ ~ ~ bd ~").gain(.25)',
        reason: 'A quiet kick marks the pulse without dominating the ride.'
      },
      {
        role: 'snare',
        label: 'a brush-like snare',
        snippet: 's("~ ~ sd ~ ~ ~ sd ~").gain(.2)',
        reason: 'Soft backbeats leave room for the comping.'
      },
      {
        role: 'hihat',
        label: 'a ride-like hi-hat',
        snippet: 's("hh*8").gain(1.1)',
        reason: 'A steady cymbal line is the timekeeper in a small group.'
      },
      {
        role: 'bass',
        label: 'a walking bass',
        snippet: 'note("<c2 e2 g2 a2>").s("gm_acoustic_bass").gain(.6)',
        reason: 'A walking line spells the harmony and keeps the swing.'
      },
      {
        role: 'chords',
        label: 'comping seventh chords',
        snippet: 'chord("<Cm7 F7 Bb^7 Eb^7>").voicing().s("gm_epiano1").gain(.3)',
        reason: 'Short, syncopated seventh chords are the comping.'
      },
      {
        role: 'melody',
        label: 'a vibraphone head',
        snippet: 'n("<0 2 4 5 7 9 7 4>").scale("Bb3:major").s("gm_vibraphone").gain(.35)',
        reason: 'A vibraphone line states the head over the rhythm section.'
      }
    ],
    visuals: ['pianoroll', 'pitchwheel']
  }
]

export const STRUDEL_VISUAL_REASONS: Record<StrudelVisualName, string> = {
  pianoroll: 'A pianoroll under the pattern shows its notes scroll past as they play.',
  punchcard: 'A punchcard shows every hit as a block, so the groove is visible at a glance.',
  scope: 'A scope draws the waveform, so you can see the bass and the filter move.',
  spectrum: 'A spectrum shows which frequencies the mix fills and which it leaves empty.',
  spiral: 'A spiral turns the notes into a slowly winding shape that suits long, calm pieces.',
  pitchwheel: 'A pitch wheel shows the notes as points around a circle of pitch.'
}

/**
 * The layers each visual suits, most suitable first. A visual goes on the first layer playing
 * one of these that draws nothing yet, since two visuals on one pattern draw over each other.
 */
export const STRUDEL_VISUAL_TARGET_ROLES: Record<StrudelVisualName, StrudelInstrumentRole[]> = {
  punchcard: ['kick', 'snare', 'clap', 'hihat', 'percussion', 'breaks'],
  pianoroll: ['melody', 'chords', 'bass'],
  scope: ['bass', 'melody', 'chords'],
  spectrum: ['chords', 'melody', 'bass', 'breaks', 'kick', 'snare', 'hihat', 'clap', 'percussion'],
  spiral: ['melody', 'chords'],
  pitchwheel: ['melody', 'chords', 'bass']
}

/** How each instrument is named in a hint's sentence. */
export const STRUDEL_INSTRUMENT_ROLE_LABELS: Record<StrudelInstrumentRole, string> = {
  kick: 'kick',
  snare: 'snare',
  clap: 'clap',
  hihat: 'hi-hats',
  percussion: 'percussion',
  breaks: 'sampled break',
  bass: 'bass',
  chords: 'chords',
  melody: 'melody'
}

/** Ways to keep a finished pattern moving, tried in this order. */
export const STRUDEL_PATTERN_IDEAS: StrudelPatternIdea[] = [
  {
    id: 'breakdown',
    title: 'Drop out every fourth bar',
    reason:
      'A bar without this layer now and then lets the loop breathe, and its return hits harder.',
    snippet: '.mask("<1 1 1 0>")',
    callName: 'mask',
    targetRoles: ['kick', 'breaks', 'snare', 'hihat']
  },
  {
    id: 'filter-sweep',
    title: 'Sweep the filter',
    reason:
      'A filter opening and closing over eight bars builds tension without a single new note. It moves once per note, so a busy line sweeps smoothly and a held one in steps.',
    snippet: '.lpf(sine.range(300, 3000).slow(8))',
    callName: 'sine',
    targetRoles: ['bass', 'chords', 'melody'],
    unsuitedSounds: ['sine']
  },
  {
    id: 'phrase-answer',
    title: 'Turn the phrase round every fourth bar',
    reason: 'Reversing the last of every four bars answers the phrase instead of repeating it.',
    snippet: '.lastOf(4, (x) => x.rev())',
    callName: 'lastOf',
    targetRoles: ['melody', 'chords']
  },
  {
    id: 'drum-fills',
    title: 'Add drum fills',
    reason: 'Doubling a few hits at random keeps a repeating beat from sounding like a loop.',
    snippet: '.sometimesBy(.2, (x) => x.ply(2))',
    callName: 'sometimesBy',
    targetRoles: ['hihat', 'snare', 'percussion', 'clap', 'kick']
  },
  {
    id: 'swing',
    title: 'Swing the hi-hats',
    reason: 'Pushing every other hat a little late gives a straight groove some shuffle.',
    snippet: '.swingBy(1/3, 4)',
    callName: 'swingBy',
    targetRoles: ['hihat']
  },
  {
    id: 'stereo',
    title: 'Spread it across the speakers',
    reason: 'A reversed copy in the other ear makes a layer wide without making it louder.',
    snippet: '.jux(rev)',
    callName: 'jux',
    targetRoles: ['percussion', 'melody']
  },
  {
    id: 'echo',
    title: 'Add an echo',
    reason: 'An echo fills the gaps between hits and ties the layers together.',
    snippet: '.delay(.4)',
    callName: 'delay',
    targetRoles: ['chords', 'clap', 'melody']
  }
]
/** How many ideas the hints tab shows at once, so the next step stays easy to pick. */
export const STRUDEL_PATTERN_IDEA_LIMIT = 3

/** Sound names, as written in a pattern's strings, and the instrument each one plays. */
export const STRUDEL_INSTRUMENT_SOUND_NAMES: Record<StrudelInstrumentRole, string[]> = {
  kick: ['bd', 'kick', '808bd', '909bd'],
  snare: ['sd', 'sn', 'snare', '808sd', '909sd'],
  clap: ['cp', 'clap', 'rm', 'rim', 'realclaps'],
  hihat: ['hh', 'hc', 'oh', 'ho', 'hihat', '808hc', '808oh', 'hh27'],
  percussion: ['perc', 'lt', 'mt', 'ht', 'tabla', 'cr', 'click', 'cb', 'cowbell', 'shaker', 'tom'],
  breaks: ['breaks125', 'breaks152', 'breaks157', 'breaks165', 'amencutup', 'amen'],
  bass: ['bass', 'bass1', 'bass2', 'bass3', 'jvbass', 'subroc3d'],
  chords: ['pad', 'padlong'],
  melody: ['arpy', 'piano', 'casio', 'pluck', 'lead']
}

/** Calls that mark an instrument whatever sounds they play. */
export const STRUDEL_INSTRUMENT_CALL_NAMES: Partial<Record<StrudelInstrumentRole, string[]>> = {
  chords: ['chord', 'voicing', 'voicings'],
  melody: ['scale', 'arp']
}

/** Notes at or below this octave count as bass, and above it as melody. */
export const STRUDEL_BASS_MAX_OCTAVE = 2

/** Each method that draws a visual, inline with an underscore or behind the code without. */
export const STRUDEL_VISUAL_CALL_NAMES: Record<string, StrudelVisualName> = {
  pianoroll: 'pianoroll',
  _pianoroll: 'pianoroll',
  punchcard: 'punchcard',
  _punchcard: 'punchcard',
  scope: 'scope',
  _scope: 'scope',
  tscope: 'scope',
  _tscope: 'scope',
  spectrum: 'spectrum',
  _spectrum: 'spectrum',
  spiral: 'spiral',
  _spiral: 'spiral',
  pitchwheel: 'pitchwheel',
  _pitchwheel: 'pitchwheel'
}

/** Tempo calls and the factor from their argument to beats per minute, at four beats a cycle. */
export const STRUDEL_TEMPO_CALL_FACTORS: Record<string, number> = {
  setcps: 240,
  setCps: 240,
  setcpm: 4,
  setCpm: 4
}

/** Top-level calls that set things up rather than make sound. */
export const STRUDEL_SETUP_CALL_NAMES = [
  'setcps',
  'setCps',
  'setcpm',
  'setCpm',
  'samples',
  'all',
  'each',
  'hush'
]

/** A pixel this far from the page colour is faint ink: a staff line, a bar line or a tie. */
export const TAB_FAINT_DEVIATION = 25
/** A pixel this far from the page colour is bright ink: a fret digit, a stem or a beam. */
export const TAB_BRIGHT_DEVIATION = 100
export const TAB_BACKGROUND_SAMPLE_STRIDE = 7
/** Printed words such as a tempo are dimmer than a fret number, so they get their own level. */
export const TAB_TEXT_DEVIATION = 50
export const TAB_LUMINANCE_WEIGHTS = { red: 0.299, green: 0.587, blue: 0.114 }

/** Every length below is a multiple of the gap between two staff lines, so any zoom works. */
export const TAB_LINE_COVERAGE_RATIO = 0.5
export const TAB_SYSTEM_BREAK_GAP_RATIO = 2
export const TAB_LINE_START_RUN_RATIO = 2
export const TAB_BAR_LINE_COVERAGE_RATIO = 0.9
export const TAB_BAR_MERGE_GAP_RATIO = 0.5
/** Narrower than this and a vertical stroke is a clef, a cursor or a stray line, not a bar. */
export const TAB_BAR_MIN_WIDTH_RATIO = 4
export const TAB_GLYPH_WINDOW_RATIO = 0.45
export const TAB_GLYPH_MIN_HEIGHT_RATIO = 0.6
export const TAB_GLYPH_MIN_WIDTH_RATIO = 0.25
export const TAB_GLYPH_MAX_WIDTH_RATIO = 0.8
export const TAB_GLYPH_MERGE_GAP_RATIO = 0.5
export const TAB_STEM_TOP_RATIO = 1
export const TAB_STEM_BOTTOM_RATIO = 2.75
export const TAB_STEM_COVERAGE_RATIO = 0.7
export const TAB_STEM_MERGE_GAP_RATIO = 0.3
export const TAB_BEAM_NEAR_RATIO = 0.25
export const TAB_BEAM_FAR_RATIO = 0.55
export const TAB_BRACKET_TOP_RATIO = 3
export const TAB_BRACKET_BOTTOM_RATIO = 3.8
export const TAB_BRACKET_MIN_SEGMENT_RATIO = 1
export const TAB_BRACKET_JOIN_GAP_RATIO = 3
export const TAB_STEM_NOTE_REACH_RATIO = 0.6

export const TAB_TEMPO_BAND_TOP_RATIO = 3.5
export const TAB_TEMPO_BAND_BOTTOM_RATIO = 1.5
export const TAB_EQUALS_MIN_WIDTH_RATIO = 0.4
export const TAB_EQUALS_MAX_WIDTH_RATIO = 1
export const TAB_EQUALS_MAX_HEIGHT_RATIO = 0.5
export const TAB_TEMPO_DIGIT_GAP_RATIO = 0.5
export const TAB_TEMPO_MAX_DIGITS = 3
export const TAB_TEMPO_MIN_BEATS_PER_MINUTE = 30
export const TAB_TEMPO_MAX_BEATS_PER_MINUTE = 300

export const TAB_BEATS_PER_BAR = 4
/** Beats a stem lasts by how many beams or flags it carries: none, one, two, three. */
export const TAB_BEAM_BEATS = [1, 0.5, 0.25, 0.125]
export const TAB_TRIPLET_NUMERATOR = 2
export const TAB_TRIPLET_DENOMINATOR = 3
export const TAB_MAX_BEAMS = 3

export const TAB_INSTRUMENT_BY_LINE_COUNT: Record<number, 'bass' | 'guitar'> = {
  4: 'bass',
  6: 'guitar'
}
export const TAB_SOUNDS = {
  bass: 'gm_electric_bass_finger',
  guitar: 'gm_acoustic_guitar_nylon'
}

export const TAB_DIGIT_GRID_WIDTH = 5
export const TAB_DIGIT_GRID_HEIGHT = 7
/** Thin anti-aliased strokes read faint in a small cell, so coverage is boosted before matching. */
export const TAB_DIGIT_CONTRAST = 1
/** A glyph further than this mean squared difference from every digit is left unread. */
export const TAB_DIGIT_MAX_DISTANCE = 0.12
/**
 * Each digit sampled onto the grid, a space for no ink up to # for full ink, in one set per
 * typeface. The first set holds 0, 1, 3, 5, 7, 8 and 9 sampled from a real Songsterr screenshot,
 * with 2, 4 and 6 (which it never prints) drawn by hand in the same style. The others were sampled
 * from the browser's Arial, which also covers 2, 4 and 6 and the heavier weight of many tab sites.
 */
export const TAB_DIGIT_TEMPLATE_SETS = [
  [
    ['.##+ ', '++.#.', '#+ #+', '#+ #+', '#+ #+', '++.#.', '.##+ '],
    ['  .# ', ' +##.', ' ++#.', '  .#.', '  .#.', '  .#.', '  .# '],
    ['.##+ ', '++.#.', '  .#.', '  ##.', ' .#+ ', '.#+  ', '+####'],
    ['.##+ ', '++.#.', '  +# ', '  +# ', '   ++', '++.#+', '.##+ '],
    ['  .#.', ' .##.', '.+.#.', '+. #.', '+####', '   #.', '   #.'],
    ['.###.', '.#.. ', '+##+ ', '.+.#+', '   ++', '++.#+', '.+#+ '],
    ['.###.', '+#...', '#+.  ', '#+##.', '#+ .#', '++.+#', '.##+ '],
    ['+####', ' ..#+', '  .# ', '  ++ ', ' .#. ', ' +#  ', ' ++  '],
    [' +##.', '.#.++', ' #+++', ' ###.', '.#.+#', '.#.+#', ' ###.'],
    ['.##+ ', '++.#.', '#+ #+', '+#+#+', ' .+#+', '++.#.', '.##+ ']
  ],
  [
    ['.### ', '++ #.', '#. .+', '#. .#', '#. .+', '++ ++', '.### '],
    ['  +# ', ' +## ', ' +.# ', '  .# ', '  .# ', '  .# ', '  .# '],
    ['.###.', '++ ++', '.  ++', '  .#.', ' .#. ', '+#.  ', '####+'],
    ['.### ', '++.#.', '  .#.', '  ##.', '   ++', '#+ ++', '.###.'],
    ['  ++ ', ' .#+ ', ' +++ ', '++.+ ', '#++#.', '+++#.', '  .+ '],
    ['.###.', '.#.. ', '+#+. ', '+++#+', '   .#', '++ ++', '.###.'],
    [' ###.', '++ ++', '#+.. ', '##+#.', '#. +#', '++ ++', '.###.'],
    ['+###+', ' ..#.', '  ++ ', '  #. ', ' .+  ', ' +.  ', ' +.  '],
    ['.### ', '+#.#.', '+#.#.', '.###.', '#+ ++', '#. ++', '.###.'],
    ['.##+ ', '#+ #+', '#. +#', '+#.##', ' +++#', '+. ++', '.### ']
  ],
  [
    ['.##+ ', '+#+#.', '## #+', '#+ #+', '#+ #+', '+#.#.', '.### '],
    ['  +# ', ' +## ', '.### ', '  +# ', '  +# ', '  +# ', '  +# '],
    ['.###.', '+#.#+', '.. #+', '  +#.', ' +#. ', '+#+..', '####+'],
    ['.##+ ', '+#+#.', ' .+#.', '  ##.', '   #+', '+#.#+', '.###.'],
    ['  +#.', ' .##.', ' ###.', '+#+#.', '##+#+', '++##+', '  .#.'],
    ['.###+', '.#++.', '.#+. ', '+#+#+', '   ##', '+#.#+', '.###.'],
    [' +##.', '+#.#+', '##.. ', '####+', '## ##', '+#.#+', '.###.'],
    ['#####', '+++#+', '  +# ', ' .#. ', ' +#  ', ' ++  ', ' #+  '],
    ['.##+ ', '+#.#.', '+#.#.', '.###.', '##.#+', '##.#+', '.###.'],
    ['.##+ ', '##+#.', '#+ #+', '+#+#+', ' ++#+', '++.#.', '.##+ ']
  ]
]

/** How many cycles the flow's notation reads to find where a pattern starts over. */
export const STRUDEL_NOTE_BARS_MAX_CYCLES = 64

/** Piano scores: every length is again a multiple of the staff line gap. */
export const SCORE_STAFF_LINE_COUNT = 5
/** A treble and a bass staff further apart than this are two systems, not one grand staff. */
export const SCORE_GRAND_STAFF_MAX_GAP_RATIO = 12
/** A horizontal stroke no thicker than this is a staff line, ledger line, tie or slur. */
export const SCORE_THIN_LINE_RATIO = 0.2
export const SCORE_CLEF_ZONE_RATIO = 3.6
export const SCORE_TREBLE_CLEF_REACH_RATIO = 1
export const SCORE_PRELUDE_SEARCH_RATIO = 16
export const SCORE_KEY_STEP_RATIO = 1.5
export const SCORE_METRE_REACH_RATIO = 2.5
export const SCORE_METRE_MIN_HEIGHT_RATIO = 1.5
export const SCORE_METRE_MIN_WIDTH_RATIO = 0.9
export const SCORE_METRE_PIECE_GAP_RATIO = 0.5
/** Thinner than this is the system's opening line, not a clef or a sign. */
export const SCORE_PRELUDE_MIN_WIDTH_RATIO = 0.3
/** Shorter than this is a clef dot or a speck, skipped while reading the key. */
export const SCORE_PRELUDE_SPECK_RATIO = 0.6
export const SCORE_COMMON_TIME_BEATS = 4
export const SCORE_ACCIDENTAL_MIN_HEIGHT_RATIO = 1.6
export const SCORE_ACCIDENTAL_MAX_WIDTH_RATIO = 1.3
export const SCORE_ACCIDENTAL_STROKE_RATIO = 1.4
export const SCORE_NATURAL_OFFSET_RATIO = 0.6
export const SCORE_FLAT_MAX_WIDTH_RATIO = 1.1
export const SCORE_FLAT_BOWL_RATIO = 0.4
/** A pixel whose horizontal and vertical runs both reach these is inside a filled note head. */
export const SCORE_HEAD_CORE_WIDTH_RATIO = 0.8
export const SCORE_HEAD_CORE_HEIGHT_RATIO = 0.75
export const SCORE_HEAD_CORE_MIN_RATIO = 0.35
export const SCORE_HEAD_HALF_WIDTH_RATIO = 0.65
export const SCORE_HEAD_HALF_HEIGHT_RATIO = 0.5
export const SCORE_HOLE_REACH_RATIO = 0.45
export const SCORE_HOLE_MIN_WIDTH_RATIO = 0.2
export const SCORE_HOLE_MAX_WIDTH_RATIO = 1
export const SCORE_HOLE_MAX_HEIGHT_RATIO = 0.7
export const SCORE_HOLLOW_MIN_WIDTH_RATIO = 1
export const SCORE_STEM_MIN_RATIO = 2.5
export const SCORE_STEM_ATTACH_RATIO = 0.8
export const SCORE_BEAM_SEARCH_RATIO = 1.8
export const SCORE_BEAM_NEAR_RATIO = 0.3
export const SCORE_BEAM_FAR_RATIO = 0.8
export const SCORE_DOT_FAR_RATIO = 1.6
export const SCORE_DOT_MAX_SIZE_RATIO = 0.6
export const SCORE_DOT_ABOVE_RATIO = 1
export const SCORE_DOT_BELOW_RATIO = 0.35
export const SCORE_ACCIDENTAL_REACH_RATIO = 1.5
/** Smaller than this in both directions is a dot or a speck, never a rest or a skipped mark. */
export const SCORE_MARK_MIN_SIZE_RATIO = 0.6
export const SCORE_REST_BLOCK_MAX_RATIO = 0.8
export const SCORE_REST_QUARTER_MIN_RATIO = 2.3
export const SCORE_REST_MIN_WIDTH_RATIO = 0.45
export const SCORE_REST_MAX_WIDTH_RATIO = 1.6
export const SCORE_REST_MAX_STROKE_RATIO = 1.5
/** A quarter rest has one long stroke too, but it sits in a dense body a stem never has. */
export const SCORE_REST_MIN_DENSITY = 0.4
export const SCORE_REST_BEATS = { whole: 4, half: 2, quarter: 1, eighth: 0.5 }
/** Only blobs up to this size are joined back together; a beamed group never is. */
export const SCORE_MARK_MERGE_MAX_RATIO = 3.5
/** Letter steps above C0 of each clef's bottom line: E4 for treble, G2 for bass. */
export const SCORE_BOTTOM_LINE_STEP = { treble: 30, bass: 18 }
/** Letters counted from C as 0: the order sharps, then flats, are added to a key. */
export const SCORE_SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]
export const SCORE_FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]
export const SCORE_LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11]
/** How far above and below its staff a note head is still looked for. */
export const SCORE_ZONE_REACH_RATIO = 4
/** Heads and rests closer together than this start at the same moment. */
export const SCORE_ONSET_GROUP_RATIO = 0.6
export const SCORE_WHOLE_NOTE_MIN_WIDTH_RATIO = 1.4
export const SCORE_DOT_FACTOR = 1.5
export const SCORE_HOLLOW_BEATS = 2
export const SCORE_SOUND = 'gm_piano'

/** The visual a tab or score import draws under each instrument's line when asked to. */
export const IMPORT_VISUAL_CALL = '._pianoroll()'

/** Import code as it was first written: no visual under the lines. */
export const IMPORT_CODE_PLAIN: ImportCodeOptions = { addVisualizer: false }
export const SCORE_MARK_MERGE_MARGIN_RATIO = 0.3
export const SCORE_UNREAD_REACH_RATIO = 1.5
export const SCORE_BAR_LINE_MAX_WIDTH_RATIO = 0.4
export const SCORE_HOLLOW_CLEARANCE_RATIO = 1.5
/** Rests sit near the middle line, a second voice's a little off it. */
export const SCORE_REST_CENTRE_REACH_RATIO = 1.5
/** A rest shaped mark this close in front of a head is a grace note leading into it. */
export const SCORE_GRACE_REACH_RATIO = 1
export const SCORE_REST_BLOCK_MIN_HEIGHT_RATIO = 0.4
export const SCORE_REST_BLOCK_MIN_WIDTH_RATIO = 0.9
export const SCORE_REST_BLOCK_MIN_DENSITY = 0.7
export const SCORE_REST_LINE_TOUCH_PIXELS = 2
/** A score prints its tempo higher above the staff than a tab, in a wider type. */
export const SCORE_TEMPO_BAND = {
  topRatio: 5,
  bottomRatio: 1.5,
  equalsMaxWidthRatio: 1.6,
  equalsMaxHeightRatio: 1,
  digitMaxWidthRatio: 1.4
}
export const SCORE_RING_INSET_RATIO = 0.25
