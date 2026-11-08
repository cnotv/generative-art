import type { StonerGuitarTone } from './types'

export const STONER_GUITAR_DEFAULT_TONE: StonerGuitarTone = {
  drive: 0.75,
  tone: 0.45,
  bass: 0.7,
  mids: 0.35,
  sustain: 0.6
}

export const STONER_GUITAR_SAMPLE_RATE = 32000
export const STONER_GUITAR_TAG = 'stoner-guitar'
export const STONER_GUITAR_GROUP_LABEL = 'Stoner guitar'

export const STONER_GUITAR_SOUND_NAMES = {
  chord: 'stoner_chord',
  mute: 'stoner_mute',
  note: 'stoner_note'
}

/** Every three semitones, so the sampler never repitches a sample by more than 1.5. */
export const STONER_GUITAR_NOTES = {
  chord: ['c2', 'ds2', 'fs2', 'a2', 'c3', 'ds3', 'fs3', 'a3', 'c4'],
  mute: ['c2', 'ds2', 'fs2', 'a2', 'c3', 'ds3', 'fs3', 'a3', 'c4'],
  note: ['c2', 'ds2', 'fs2', 'a2', 'c3', 'ds3', 'fs3', 'a3', 'c4', 'ds4', 'fs4', 'a4', 'c5']
}

export const STONER_GUITAR_DURATION_SECONDS = {
  chord: 4,
  mute: 0.6,
  note: 3
}

export const STONER_GUITAR_STRUM_SPACING_SECONDS = 0.008
export const STONER_GUITAR_TAKE_DETUNE_CENTS = 4
export const STONER_GUITAR_FADE_IN_SECONDS = 0.002
export const STONER_GUITAR_FADE_OUT_SECONDS = 0.05
/** -1 dBFS, so a lossy encode after export cannot clip. */
export const STONER_GUITAR_PEAK = 0.89

export const STONER_GUITAR_MIN_DECAY_SECONDS = 1.5
export const STONER_GUITAR_MAX_DECAY_SECONDS = 8
export const STONER_GUITAR_MUTED_DECAY_SECONDS = 0.25
export const STONER_GUITAR_MUTED_LOWPASS_HZ = 600
export const STONER_GUITAR_PICK_POSITION = 0.13

export const STONER_GUITAR_STORAGE_KEY_TONE = 'strudel-stoner-guitar-tone'
export const STONER_GUITAR_STORAGE_KEY_API_KEY = 'strudel-stoner-guitar-openrouter-key'
export const STONER_GUITAR_STORAGE_KEY_MODEL = 'strudel-stoner-guitar-openrouter-model'
export const STONER_GUITAR_REGENERATE_DELAY_MS = 400

export const STONER_GUITAR_OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
export const STONER_GUITAR_DEFAULT_MODEL = 'anthropic/claude-haiku-5.5'

export const STONER_GUITAR_USAGE_HINT = 'note("c2 c2 ds2 f2").s("stoner_chord")'

export const STONER_GUITAR_KNOB_LABELS = [
  { id: 'drive', label: 'Drive', hint: 'Fuzz gain' },
  { id: 'tone', label: 'Tone', hint: 'Treble' },
  { id: 'bass', label: 'Bass', hint: 'Low end before the fuzz' },
  { id: 'mids', label: 'Mids', hint: 'Scooped to hump' },
  { id: 'sustain', label: 'Sustain', hint: 'Ring time' }
]

const TONE_KNOB_SCHEMA = { type: 'number', minimum: 0, maximum: 1 }

export const STONER_GUITAR_TONE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    drive: TONE_KNOB_SCHEMA,
    tone: TONE_KNOB_SCHEMA,
    bass: TONE_KNOB_SCHEMA,
    mids: TONE_KNOB_SCHEMA,
    sustain: TONE_KNOB_SCHEMA,
    explanation: { type: 'string' }
  },
  required: ['drive', 'tone', 'bass', 'mids', 'sustain', 'explanation'],
  additionalProperties: false
}

export const STONER_GUITAR_ASSISTANT_SYSTEM_PROMPT = `You set the five knobs of a stoner rock guitar fuzz. Every knob is a number from 0 to 1.
drive: fuzz gain. Low is a crunchy overdrive, high is a wall of fuzz with endless sustain.
tone: treble. Low is dark and woolly, high is bright and fizzy.
bass: low end boosted before the fuzz. High makes the lows thick and woolly, low keeps them tight.
mids: 0 is scooped, 0.5 is neutral, 1 is a mid hump.
sustain: how long the strings ring. Low is short and dry, high rings for seconds.
References: Kyuss is scooped mids, plenty of bass, high drive. Sleep is a huge low end with a mid hump. Black Sabbath is less drive with the mids forward. Electric Wizard is maximum drive and bass, dark tone.
Answer with the five numbers and one or two sentences explaining the choices in guitar terms.`

export const STONER_GUITAR_ASSISTANT_ERRORS = {
  unauthorised: 'OpenRouter did not accept the key. Check it and try again.',
  noCredit: 'The OpenRouter account has no credit left for this model.',
  rateLimited: 'OpenRouter is rate limiting this key. Wait a moment and try again.',
  network: 'Could not reach OpenRouter. Check the connection and try again.',
  badAnswer: 'The model did not return usable tone settings. Try again or pick another model.',
  other: 'OpenRouter returned an error'
}
