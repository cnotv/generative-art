import type {
  BodyResonance,
  FuzzChain,
  InstrumentKindDefinition,
  InstrumentKind,
  InstrumentPreset,
  DrumVoice,
  OrganDrawbar,
  StringModel
} from './types'

export const INSTRUMENT_SAMPLE_RATE = 32000
export const INSTRUMENT_TAG_PREFIX = 'instrument'
export const INSTRUMENT_NAME_PATTERN = /^[a-z][\da-z]*$/
export const INSTRUMENT_NAME_MAX_LENGTH = 16
export const INSTRUMENT_REGENERATE_DELAY_MS = 400
export const INSTRUMENT_FADE_IN_SECONDS = 0.002
export const INSTRUMENT_FADE_OUT_SECONDS = 0.05
/** -1 dBFS, so a lossy encode after export cannot clip. */
export const INSTRUMENT_PEAK = 0.89
export const INSTRUMENT_SECOND_TAKE_SEED_OFFSET = 1000

export const INSTRUMENT_STORAGE_KEY = 'strudel-instruments'

export const INSTRUMENT_NAME_ERRORS = {
  empty: 'Give the preset a name.',
  shape: 'Use lowercase letters and digits only, starting with a letter.',
  tooLong: 'Use at most 16 characters.',
  taken: 'A preset with this name already exists.',
  soundTaken: 'Strudel already has a sound with this name.'
}

const ELECTRIC_NOTES = ['a1', 'c2', 'ds2', 'fs2', 'a2', 'c3', 'ds3', 'fs3', 'a3', 'c4']
const ELECTRIC_LEAD_NOTES = [...ELECTRIC_NOTES, 'ds4', 'fs4', 'a4', 'c5']
const BASS_NOTES = ['a0', 'c1', 'ds1', 'fs1', 'a1', 'c2', 'ds2', 'fs2', 'a2', 'c3']
const ORGAN_NOTES = [
  'c2',
  'ds2',
  'fs2',
  'a2',
  'c3',
  'ds3',
  'fs3',
  'a3',
  'c4',
  'ds4',
  'fs4',
  'a4',
  'c5'
]

/** Every three semitones, so the sampler never repitches a sample by more than 1.5. */
export const INSTRUMENT_KINDS: Record<InstrumentKind, InstrumentKindDefinition> = {
  'electric-guitar': {
    label: 'Electric guitar',
    knobs: [
      {
        id: 'drive',
        label: 'Drive',
        hint: 'Clean to fuzz'
      },
      { id: 'tone', label: 'Tone', hint: 'Treble' },
      { id: 'bass', label: 'Bass', hint: 'Low end before the fuzz' },
      { id: 'mids', label: 'Mids', hint: 'Scooped to hump' },
      { id: 'sustain', label: 'Sustain', hint: 'Ring time' }
    ],
    articulations: [
      {
        id: 'chord',
        label: 'Power chord',
        familyId: 'strings',
        notes: ELECTRIC_NOTES,
        durationSeconds: 4,
        peak: 0.445
      },
      {
        id: 'mute',
        label: 'Palm mute',
        familyId: 'strings',
        notes: ELECTRIC_NOTES,
        durationSeconds: 0.6,
        peak: 0.445
      },
      {
        id: 'note',
        label: 'Note',
        familyId: 'strings',
        notes: ELECTRIC_LEAD_NOTES,
        durationSeconds: 3,
        peak: 0.445
      }
    ],
    techniques: ['note', 'mute', 'chord'],
    assistantPrompt: `You set the five knobs of an electric guitar through a fuzz pedal and a 4x12 cabinet. Every knob is a number from 0 to 1.
drive: 0 is a clean guitar, 0.3 a crunch, 0.75 a wall of fuzz with endless sustain, 1 the harshest chainsaw.
tone: treble. Low is dark and woolly, high is bright and fizzy.
bass: low end boosted before the fuzz. High makes the lows thick and woolly, low keeps them tight.
mids: 0 is scooped, 0.5 is neutral, 1 is a mid hump.
sustain: how long the strings ring. Low is short and dry, high rings for seconds.
References: Kyuss is scooped mids, plenty of bass, high drive. Sleep is a huge low end with a mid hump. Nirvana is the mids forward with less drive. Entombed is maximum drive, scooped mids, boosted lows and highs, tight sustain.
Answer with the five numbers and one or two sentences explaining the choices in guitar terms.`,
    example: `setcpm(72/4)
$: note("a1 ~ ~ c2 ~ ~ ds2 ~").s("{name}:chord")
$: note("~ a1 a1 ~ a1 a1 ~ a1").s("{name}:mute")
`
  },
  'bass-guitar': {
    label: 'Bass guitar',
    knobs: [
      { id: 'drive', label: 'Drive', hint: 'Gentle grit to fuzz' },
      { id: 'tone', label: 'Tone', hint: 'Treble' },
      { id: 'attack', label: 'Attack', hint: 'Soft finger to hard pick' },
      { id: 'mids', label: 'Mids', hint: 'Scooped to hump' },
      { id: 'sustain', label: 'Sustain', hint: 'Ring time' }
    ],
    articulations: [
      {
        id: 'note',
        label: 'Note',
        familyId: 'bass',
        notes: BASS_NOTES,
        durationSeconds: 3,
        peak: 0.445
      },
      {
        id: 'mute',
        label: 'Muted note',
        familyId: 'bass',
        notes: BASS_NOTES,
        durationSeconds: 0.5,
        peak: 0.445
      }
    ],
    techniques: ['note', 'mute'],
    assistantPrompt: `You set the five knobs of a bass guitar through a gentle drive into a bass cabinet. Every knob is a number from 0 to 1.
drive: 0 is clean, 0.5 is a growl, 1 is a thick fuzz.
tone: treble. Low is dark and round, high is clanky.
attack: 0 is a soft finger pluck, 1 is a hard pick with a bright click.
mids: 0 is scooped, 0.5 is neutral, 1 is a mid hump that cuts through guitars.
sustain: how long the strings ring. Low is short and tight, high rings for seconds.
Answer with the five numbers and one or two sentences explaining the choices in bass terms.`,
    example: `setcpm(72/4)
$: note("a0 ~ a0 c1 ~ ds1 e1 ~").s("{name}")
$: note("~ a0 ~ ~ a0 ~ ~ a0").s("{name}:mute")
`
  },
  'acoustic-guitar': {
    label: 'Acoustic guitar',
    knobs: [
      { id: 'body', label: 'Body', hint: 'Wooden resonance of the box' },
      { id: 'brightness', label: 'Brightness', hint: 'Fresh to old strings' },
      { id: 'sustain', label: 'Sustain', hint: 'Ring time' },
      { id: 'strum', label: 'Strum speed', hint: 'Fast rake to slow strum' },
      { id: 'width', label: 'Width', hint: 'Mono to wide stereo' }
    ],
    articulations: [
      {
        id: 'chord',
        label: 'Power chord',
        familyId: 'strings',
        notes: ELECTRIC_NOTES,
        durationSeconds: 4,
        peak: 0.445
      },
      {
        id: 'mute',
        label: 'Palm mute',
        familyId: 'strings',
        notes: ELECTRIC_NOTES,
        durationSeconds: 0.6,
        peak: 0.445
      },
      {
        id: 'note',
        label: 'Note',
        familyId: 'strings',
        notes: ELECTRIC_LEAD_NOTES,
        durationSeconds: 3,
        peak: 0.445
      }
    ],
    techniques: ['note', 'mute', 'chord'],
    assistantPrompt: `You set the five knobs of an acoustic guitar. Every knob is a number from 0 to 1.
body: the wooden resonance of the box. Low is thin, high is a big warm dreadnought.
brightness: 0 is old dull strings, 1 is bright new strings.
sustain: how long the strings ring. Low is short and dry, high rings for seconds.
strum: how slowly the strings of a chord are raked. 0 is a quick rake, 1 is a slow strum.
width: 0 is mono, 1 is a wide stereo image.
Answer with the five numbers and one or two sentences explaining the choices in guitar terms.`,
    example: `setcpm(80/4)
$: note("a2 ~ ~ c3 ~ ~ e3 ~").s("{name}:chord")
$: note("~ ~ a3 ~ c4 ~ ~ e4").s("{name}")
`
  },
  organ: {
    label: 'Organ',
    knobs: [
      { id: 'body', label: 'Body', hint: 'Low drawbars' },
      { id: 'brightness', label: 'Brightness', hint: 'Upper drawbars' },
      { id: 'percussion', label: 'Percussion', hint: 'Key click and a fast decaying harmonic' },
      { id: 'drive', label: 'Drive', hint: 'Soft overdrive of the amp' },
      { id: 'vibrato', label: 'Vibrato', hint: 'Chorus and vibrato depth' }
    ],
    articulations: [
      {
        id: 'note',
        label: 'Note',
        familyId: 'keys',
        notes: ORGAN_NOTES,
        durationSeconds: 3,
        peak: 0.445
      }
    ],
    techniques: ['note'],
    assistantPrompt: `You set the five knobs of a tonewheel organ. Every knob is a number from 0 to 1.
body: the low drawbars (16 foot, 8 foot, 5 and a third foot). High is a deep, round sound.
brightness: the upper drawbars. Low is flute like, high is a screaming full organ.
percussion: a key click and a short decaying third harmonic, like Hammond percussion.
drive: soft overdrive of the amplifier. 0 is clean, 1 is a growling Leslie cabinet.
vibrato: depth of the vibrato and chorus. 0 is none.
Answer with the five numbers and one or two sentences explaining the choices in organ terms.`,
    example: `setcpm(70/4)
$: note("[c3,ds3,g3] [f3,a3,c4] [g3,b3,d4] [c3,ds3,g3]").s("{name}").gain(0.5)
`
  },
  'drum-kit': {
    label: 'Drum kit',
    knobs: [
      { id: 'tune', label: 'Tune', hint: 'Pitch of the drums' },
      { id: 'decay', label: 'Decay', hint: 'Tight to ringing' },
      { id: 'punch', label: 'Punch', hint: 'Beater and stick click' },
      { id: 'drive', label: 'Drive', hint: 'Saturation' },
      { id: 'room', label: 'Room', hint: 'Dry to a big room' }
    ],
    articulations: [
      { id: 'kick', label: 'Kick', familyId: 'kick', notes: [], durationSeconds: 0.6, peak: 0.8 },
      {
        id: 'snare',
        label: 'Snare',
        familyId: 'snare',
        notes: [],
        durationSeconds: 0.7,
        peak: 0.8
      },
      {
        id: 'tomhi',
        label: 'High tom',
        familyId: 'tom',
        notes: [],
        durationSeconds: 0.7,
        peak: 0.75
      },
      {
        id: 'tommid',
        label: 'Mid tom',
        familyId: 'tom',
        notes: [],
        durationSeconds: 0.8,
        peak: 0.75
      },
      {
        id: 'tomlow',
        label: 'Low tom',
        familyId: 'tom',
        notes: [],
        durationSeconds: 0.9,
        peak: 0.75
      },
      {
        id: 'hatclosed',
        label: 'Closed hi-hat',
        familyId: 'hihat',
        notes: [],
        durationSeconds: 0.2,
        peak: 0.45
      },
      {
        id: 'hatopen',
        label: 'Open hi-hat',
        familyId: 'hihat',
        notes: [],
        durationSeconds: 0.8,
        peak: 0.5
      },
      { id: 'ride', label: 'Ride', familyId: 'cymbal', notes: [], durationSeconds: 2, peak: 0.5 },
      {
        id: 'crash',
        label: 'Crash',
        familyId: 'cymbal',
        notes: [],
        durationSeconds: 2.5,
        peak: 0.55
      }
    ],
    techniques: [],
    assistantPrompt: `You set the five knobs of a synthesised drum kit. Every knob is a number from 0 to 1.
tune: pitch of the drums. 0.5 is neutral, low is deeper, high is tighter and higher.
decay: 0 is dead tight, 1 rings on.
punch: the beater and stick click. High cuts through a wall of guitars.
drive: saturation. 0 is clean, 1 is crunchy.
room: 0 is a dry booth, 1 is a big roomy hall.
References: death metal is a tight, clicky kit with a short decay and almost no room. Stoner rock and grunge are a big roomy kit with a longer decay and less click.
Answer with the five numbers and one or two sentences explaining the choices in drummer terms.`,
    example: `setcpm(100/4)
$: s("{name}_kick ~ {name}_snare ~ {name}_kick {name}_kick {name}_snare ~").gain(0.5)
$: s("{name}_hatclosed*8").gain(0.3)
$: s("{name}_crash ~ ~ ~").gain(0.3)
`
  }
}

export const INSTRUMENT_KIND_IDS: InstrumentKind[] = [
  'electric-guitar',
  'bass-guitar',
  'acoustic-guitar',
  'organ',
  'drum-kit'
]

export const INSTRUMENT_KIND_OPTIONS = [
  { value: 'electric-guitar', label: 'Electric guitar' },
  { value: 'bass-guitar', label: 'Bass guitar' },
  { value: 'acoustic-guitar', label: 'Acoustic guitar' },
  { value: 'organ', label: 'Organ' },
  { value: 'drum-kit', label: 'Drum kit' }
]

export const INSTRUMENT_BUILT_IN_PRESETS: InstrumentPreset[] = [
  {
    name: 'stoner',
    kind: 'electric-guitar',
    knobs: { drive: 0.75, tone: 0.45, bass: 0.7, mids: 0.35, sustain: 0.6 }
  },
  {
    name: 'seattle',
    kind: 'electric-guitar',
    knobs: { drive: 0.55, tone: 0.5, bass: 0.45, mids: 0.65, sustain: 0.5 }
  },
  {
    name: 'jangle',
    kind: 'electric-guitar',
    knobs: { drive: 0.04, tone: 0.6, bass: 0.3, mids: 0.5, sustain: 0.45 }
  },
  {
    name: 'chainsaw',
    kind: 'electric-guitar',
    knobs: { drive: 1, tone: 0.85, bass: 0.85, mids: 0, sustain: 0.3 }
  },
  {
    name: 'fuzzbass',
    kind: 'bass-guitar',
    knobs: { drive: 0.7, tone: 0.4, attack: 0.3, mids: 0.4, sustain: 0.75 }
  },
  {
    name: 'grungebass',
    kind: 'bass-guitar',
    knobs: { drive: 0.35, tone: 0.5, attack: 0.45, mids: 0.6, sustain: 0.6 }
  },
  {
    name: 'deathbass',
    kind: 'bass-guitar',
    knobs: { drive: 0.5, tone: 0.75, attack: 0.9, mids: 0.55, sustain: 0.4 }
  },
  {
    name: 'campfire',
    kind: 'acoustic-guitar',
    knobs: { body: 0.6, brightness: 0.55, sustain: 0.5, strum: 0.5, width: 0.6 }
  },
  {
    name: 'doomorgan',
    kind: 'organ',
    knobs: { body: 0.8, brightness: 0.3, percussion: 0.2, drive: 0.55, vibrato: 0.5 }
  },
  {
    name: 'garagekit',
    kind: 'drum-kit',
    knobs: { tune: 0.45, decay: 0.65, punch: 0.5, drive: 0.35, room: 0.6 }
  },
  {
    name: 'blastkit',
    kind: 'drum-kit',
    knobs: { tune: 0.55, decay: 0.25, punch: 0.9, drive: 0.25, room: 0.1 }
  }
]

/** What a new preset of each kind starts from. */
export const INSTRUMENT_NEW_PRESET_KNOBS: Record<InstrumentKind, Record<string, number>> = {
  'electric-guitar': { drive: 0.6, tone: 0.5, bass: 0.5, mids: 0.5, sustain: 0.5 },
  'bass-guitar': { drive: 0.4, tone: 0.5, attack: 0.5, mids: 0.5, sustain: 0.5 },
  'acoustic-guitar': { body: 0.5, brightness: 0.5, sustain: 0.5, strum: 0.5, width: 0.5 },
  organ: { body: 0.6, brightness: 0.5, percussion: 0.3, drive: 0.3, vibrato: 0.4 },
  'drum-kit': { tune: 0.5, decay: 0.5, punch: 0.5, drive: 0.3, room: 0.3 }
}

export const INSTRUMENT_STRING_MODELS: Record<
  'electric-guitar' | 'bass-guitar' | 'acoustic-guitar',
  StringModel
> = {
  'electric-guitar': {
    minDecaySeconds: 1.5,
    maxDecaySeconds: 8,
    mutedDecaySeconds: 0.25,
    mutedLowpassHz: 600,
    pickPosition: 0.13,
    chordSemitones: [0, 7, 12],
    strumSpacingSeconds: 0.008,
    takeDetuneCents: 4
  },
  'bass-guitar': {
    minDecaySeconds: 1,
    maxDecaySeconds: 6,
    mutedDecaySeconds: 0.2,
    mutedLowpassHz: 350,
    pickPosition: 0.2,
    chordSemitones: [0],
    strumSpacingSeconds: 0,
    takeDetuneCents: 3
  },
  'acoustic-guitar': {
    minDecaySeconds: 0.8,
    maxDecaySeconds: 3.5,
    mutedDecaySeconds: 0.15,
    mutedLowpassHz: 1200,
    pickPosition: 0.18,
    chordSemitones: [0, 7, 12, 19],
    strumSpacingSeconds: 0.015,
    takeDetuneCents: 5
  }
}

/** The pick softening range of a bass: a finger is soft, a pick is hard. */
export const INSTRUMENT_BASS_SOFTENING = { finger: 0.9, pick: 0.15 }
export const INSTRUMENT_ELECTRIC_SOFTENING = 0.5
export const INSTRUMENT_ACOUSTIC_SOFTENING = { dull: 0.8, bright: 0.3 }
export const INSTRUMENT_BASS_FIXED_LOW_END = 0.3

export const INSTRUMENT_ELECTRIC_CHAIN: FuzzChain = {
  inputHighpassHz: 40,
  bassShelfHz: 200,
  bassShelfMaxDecibels: 12,
  driveMinDecibels: -24,
  driveRangeDecibels: 66,
  firstStageBias: 0.2,
  secondStageGain: 4,
  midsCentreHz: 700,
  midsMinDecibels: -10,
  midsRangeDecibels: 16,
  trebleMinHz: 1800,
  trebleMaxHz: 7000,
  cabinetHighpassHz: 80,
  cabinetThumpHz: 110,
  cabinetThumpDecibels: 4,
  cabinetLowpassHz: [5000, 6500]
}

export const INSTRUMENT_BASS_CHAIN: FuzzChain = {
  inputHighpassHz: 25,
  bassShelfHz: 120,
  bassShelfMaxDecibels: 6,
  driveMinDecibels: -12,
  driveRangeDecibels: 30,
  firstStageBias: 0.1,
  secondStageGain: 2,
  midsCentreHz: 700,
  midsMinDecibels: -6,
  midsRangeDecibels: 12,
  trebleMinHz: 1200,
  trebleMaxHz: 4000,
  cabinetHighpassHz: 40,
  cabinetThumpHz: 110,
  cabinetThumpDecibels: 0,
  cabinetLowpassHz: [3500, 4500]
}

/** The box of an acoustic guitar: three wooden resonances, each boosted by the body knob. */
export const INSTRUMENT_ACOUSTIC_BODY: BodyResonance[] = [
  { centreHz: 100, maxDecibels: 8, quality: 3 },
  { centreHz: 200, maxDecibels: 7, quality: 2.5 },
  { centreHz: 400, maxDecibels: 5, quality: 2 }
]
export const INSTRUMENT_ACOUSTIC_LOWPASS_HZ = { dull: 2500, bright: 9000 }
export const INSTRUMENT_ACOUSTIC_STRUM_SPACING = { fast: 0.004, slow: 0.03 }

/** Tonewheel footages 16', 8', 5 1/3', 4', 2 2/3', 2', 1 3/5', 1 1/3' and 1'. */
export const INSTRUMENT_ORGAN_DRAWBARS: OrganDrawbar[] = [
  { ratio: 0.5, group: 'body', weight: 1 },
  { ratio: 1, group: 'fixed', weight: 1 },
  { ratio: 1.5, group: 'body', weight: 0.6 },
  { ratio: 2, group: 'brightness', weight: 0.7 },
  { ratio: 3, group: 'brightness', weight: 0.5 },
  { ratio: 4, group: 'brightness', weight: 0.5 },
  { ratio: 5, group: 'brightness', weight: 0.35 },
  { ratio: 6, group: 'brightness', weight: 0.3 },
  { ratio: 8, group: 'brightness', weight: 0.25 }
]
export const INSTRUMENT_ORGAN = {
  percussionRatio: 3,
  percussionDecaySeconds: 0.18,
  clickSeconds: 0.006,
  vibratoRateHz: 6.4,
  vibratoMaxDepthSeconds: 0.0009,
  vibratoMix: 0.5,
  vibratoRightPhase: 1.6,
  driveMaxGain: 9,
  fadeInSeconds: 0.006
}

export const INSTRUMENT_DRUM_VOICES: Record<string, DrumVoice> = {
  kick: {
    modes: [{ frequencyHz: 52, gain: 1, decaySeconds: 0.22, dropRatio: 3.2, dropSeconds: 0.035 }],
    noise: { gain: 0.25, decaySeconds: 0.008, highpassHz: 1500, lowpassHz: 6000 },
    clickGain: 0.6,
    tunable: true
  },
  snare: {
    modes: [
      { frequencyHz: 185, gain: 0.8, decaySeconds: 0.1, dropRatio: 1.3, dropSeconds: 0.02 },
      { frequencyHz: 330, gain: 0.5, decaySeconds: 0.07, dropRatio: 1.2, dropSeconds: 0.02 }
    ],
    noise: { gain: 0.9, decaySeconds: 0.16, highpassHz: 1800, lowpassHz: 9000 },
    clickGain: 0.4,
    tunable: true
  },
  tomhi: {
    modes: [
      { frequencyHz: 210, gain: 1, decaySeconds: 0.25, dropRatio: 1.4, dropSeconds: 0.04 },
      { frequencyHz: 334, gain: 0.35, decaySeconds: 0.15, dropRatio: 1.3, dropSeconds: 0.04 },
      { frequencyHz: 450, gain: 0.2, decaySeconds: 0.1, dropRatio: 1.2, dropSeconds: 0.04 }
    ],
    noise: { gain: 0.15, decaySeconds: 0.02, highpassHz: 1500, lowpassHz: 6000 },
    clickGain: 0.3,
    tunable: true
  },
  tommid: {
    modes: [
      { frequencyHz: 150, gain: 1, decaySeconds: 0.3, dropRatio: 1.4, dropSeconds: 0.045 },
      { frequencyHz: 238, gain: 0.35, decaySeconds: 0.18, dropRatio: 1.3, dropSeconds: 0.045 },
      { frequencyHz: 321, gain: 0.2, decaySeconds: 0.12, dropRatio: 1.2, dropSeconds: 0.045 }
    ],
    noise: { gain: 0.15, decaySeconds: 0.02, highpassHz: 1500, lowpassHz: 6000 },
    clickGain: 0.3,
    tunable: true
  },
  tomlow: {
    modes: [
      { frequencyHz: 100, gain: 1, decaySeconds: 0.36, dropRatio: 1.5, dropSeconds: 0.05 },
      { frequencyHz: 159, gain: 0.35, decaySeconds: 0.2, dropRatio: 1.3, dropSeconds: 0.05 },
      { frequencyHz: 214, gain: 0.2, decaySeconds: 0.14, dropRatio: 1.2, dropSeconds: 0.05 }
    ],
    noise: { gain: 0.15, decaySeconds: 0.02, highpassHz: 1500, lowpassHz: 6000 },
    clickGain: 0.3,
    tunable: true
  },
  hatclosed: {
    modes: [
      { frequencyHz: 5240, gain: 0.25, decaySeconds: 0.03, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 6870, gain: 0.25, decaySeconds: 0.03, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 8530, gain: 0.25, decaySeconds: 0.03, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 10970, gain: 0.25, decaySeconds: 0.03, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 12100, gain: 0.25, decaySeconds: 0.03, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 13190, gain: 0.25, decaySeconds: 0.03, dropRatio: 1, dropSeconds: 0.01 }
    ],
    noise: { gain: 0.9, decaySeconds: 0.04, highpassHz: 6500, lowpassHz: 12000 },
    clickGain: 0.2,
    tunable: false
  },
  hatopen: {
    modes: [
      { frequencyHz: 5240, gain: 0.25, decaySeconds: 0.2, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 6870, gain: 0.25, decaySeconds: 0.2, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 8530, gain: 0.25, decaySeconds: 0.2, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 10970, gain: 0.25, decaySeconds: 0.2, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 12100, gain: 0.25, decaySeconds: 0.2, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 13190, gain: 0.25, decaySeconds: 0.2, dropRatio: 1, dropSeconds: 0.01 }
    ],
    noise: { gain: 0.9, decaySeconds: 0.22, highpassHz: 6500, lowpassHz: 12000 },
    clickGain: 0.2,
    tunable: false
  },
  ride: {
    modes: [
      { frequencyHz: 3100, gain: 0.6, decaySeconds: 0.7, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 4270, gain: 0.25, decaySeconds: 0.9, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 5880, gain: 0.25, decaySeconds: 0.9, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 7450, gain: 0.25, decaySeconds: 0.9, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 9190, gain: 0.25, decaySeconds: 0.9, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 11030, gain: 0.25, decaySeconds: 0.9, dropRatio: 1, dropSeconds: 0.01 }
    ],
    noise: { gain: 0.35, decaySeconds: 0.5, highpassHz: 5000, lowpassHz: 12000 },
    clickGain: 0.25,
    tunable: false
  },
  crash: {
    modes: [
      { frequencyHz: 1900, gain: 0.2, decaySeconds: 0.9, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 3300, gain: 0.2, decaySeconds: 0.9, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 4800, gain: 0.2, decaySeconds: 0.9, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 6400, gain: 0.2, decaySeconds: 0.9, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 8100, gain: 0.2, decaySeconds: 0.9, dropRatio: 1, dropSeconds: 0.01 },
      { frequencyHz: 10200, gain: 0.2, decaySeconds: 0.9, dropRatio: 1, dropSeconds: 0.01 }
    ],
    noise: { gain: 1, decaySeconds: 0.9, highpassHz: 3000, lowpassHz: 12000 },
    clickGain: 0.3,
    tunable: false
  }
}
export const INSTRUMENT_DRUM = {
  tuneOctaves: 1,
  decayOctaves: 2,
  driveMaxGain: 5,
  clickSeconds: 0.004,
  roomMaxMix: 0.35,
  roomTapsSeconds: {
    left: [0.011, 0.023, 0.041, 0.067],
    right: [0.017, 0.031, 0.053, 0.079]
  },
  roomTapGains: [0.7, 0.5, 0.35, 0.25],
  roomLowpassHz: 5000,
  noiseSeedOffset: 7
}

/**
 * Pattern controls that already say how long a sound lasts, `cut` by choking it at the next one; a pitched preset note given none of
 * them ends with its event, as a soundfont note does, instead of ringing its whole sample.
 */
export const INSTRUMENT_NOTE_LENGTH_CONTROLS = ['clip', 'legato', 'release', 'loop', 'cut']
