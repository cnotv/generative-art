import type { StrudelComposerActionDefinition } from './types'

export const STRUDEL_AI_OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// The key and sound model keep the names the Instruments tab first stored them under, so a key
// saved there is still found after they moved to Settings.
export const STRUDEL_AI_STORAGE_KEY_API_KEY = 'strudel-instruments-openrouter-key'
export const STRUDEL_AI_STORAGE_KEY_SOUND_MODEL = 'strudel-instruments-openrouter-model'
export const STRUDEL_AI_STORAGE_KEY_COMPOSE_MODEL = 'strudel-ai-compose-model'
export const STRUDEL_AI_STORAGE_KEY_AUTO_APPLY = 'strudel-ai-auto-apply'

export const STRUDEL_AI_DEFAULT_SOUND_MODEL = 'anthropic/claude-haiku-5.5'
export const STRUDEL_AI_DEFAULT_COMPOSE_MODEL = 'anthropic/claude-sonnet-5.5'

/** OpenRouter models that support strict JSON schema answers, checked against its model list. */
export const STRUDEL_AI_MODEL_OPTIONS = [
  { value: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5' },
  { value: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5' },
  { value: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { value: 'openai/gpt-5.4-mini', label: 'GPT-5.4 Mini' },
  { value: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash' },
  { value: 'qwen/qwen3.8-flash', label: 'Qwen3.8 Flash' }
]

export const STRUDEL_AI_ERRORS = {
  noKey: 'Add your OpenRouter key in the Settings tab first.',
  unauthorised: 'OpenRouter did not accept the key. Check it and try again.',
  noCredit: 'The OpenRouter account has no credit left for this model.',
  rateLimited: 'OpenRouter is rate limiting this key. Wait a moment and try again.',
  network: 'Could not reach OpenRouter. Check the connection and try again.',
  badAnswer: 'The model did not return a usable answer. Try again or pick another model.',
  noCode: 'The model returned no code. Try again or describe the music differently.',
  other: 'OpenRouter returned an error'
}

/** Which of the errors above each refusing HTTP status from OpenRouter means. */
export const STRUDEL_AI_STATUS_ERRORS: Record<number, keyof typeof STRUDEL_AI_ERRORS> = {
  401: 'unauthorised',
  403: 'unauthorised',
  402: 'noCredit',
  429: 'rateLimited'
}

export const STRUDEL_COMPOSER_ACTIONS: StrudelComposerActionDefinition[] = [
  {
    id: 'compose',
    label: 'Compose',
    instruction:
      'Write a new piece from the request. Ignore the current code except as a hint of taste. Put the whole program in "code".'
  },
  {
    id: 'revise',
    label: 'Revise',
    instruction:
      'Rewrite the current code as the request asks, keeping everything the request does not mention. Put the whole revised program in "code".'
  },
  {
    id: 'review',
    label: 'Review',
    instruction:
      'Review the current code with the request in mind: what works, what is wrong, and concrete changes to try. Leave "code" empty.'
  },
  {
    id: 'fix',
    label: 'Fix error',
    instruction:
      'The editor failed to run the current code with the error given as the request. Fix what causes it, and anything else that would fail the same way, keeping the music as it is. Put the whole fixed program in "code".'
  }
]

export const STRUDEL_COMPOSER_SYSTEM_PROMPT = `You compose music as Strudel code (strudel.cc), the JavaScript port of TidalCycles, for a live editor that evaluates the whole program.

Write code that runs as is:
- Set the tempo first with setcpm(bpm/4), one cycle a bar of four beats.
- One layer per "$:" block, each naming its own sound, as $: s("bd*4") or $: note("c3 e3").s("sawtooth").
- Write every pattern string in double quotes. Only a double-quoted (or backtick) string becomes a pattern with methods such as .rootNotes or .struct; a single-quoted string, an array or an object is plain JavaScript and has none of them, so 'a b'.fast(2) fails.
- Use mini notation: "<a b>" one item a cycle, "[a b]" a group in one step, "a*2" repeats, "~" a rest, "a@3" a weight.
- Write the chord plan once as a const of one chord a bar and derive bass, arpeggio and melody from it, so no part drifts onto another chord: const chords = "<Am F C G>", then chord(chords).voicing() for the chords, chords.rootNotes(2).note() for the bass roots, and n("0 2 4").chord(chords).voicing() for an arpeggio.
- Write sections with arrange([8, verse], [8, chorus]) over short "<...>" strings, never a forty item list per part.
- A song has a motif, a bass line with its own rhythm, at least two sections and an ending.
- Keep levels safe: gain at most 1 on any layer. A sample plays its whole length, so a busy line on a long sample needs .clip(1).
- Start with a comment naming the instruments each layer plays, as // bass: sawtooth, drums: RolandTR909, chords: gm_epiano1.
- Give each piece its own claps and hats; not every song should share one drum pattern.
- Comments start with //. No imports, no exports, no Markdown fences.

Sounds: drum machines such as rolandtr909_bd, rolandtr909_sd, rolandtr909_hh, rolandtr808_bd; synths sawtooth, square, triangle, sine; General MIDI voices such as gm_acoustic_bass, gm_electric_guitar_clean, gm_epiano1, gm_string_ensemble_1.

You can also design new instruments for the piece, modelled physically and rendered as samples. List each in "instruments" with:
- "name": a new name, lowercase letters and digits starting with a letter, at most 16 characters, that is not a listed preset or a Strudel sound, such as "grit" or "warmkeys".
- "kind": electric-guitar, bass-guitar, acoustic-guitar, organ or drum-kit.
- "description": one sentence on the sound, such as "a dirty pick bass with a hard attack and short sustain"; a sound designer turns it into the instrument's knobs.
Play a guitar, bass or organ as note("a1 c2").s("<name>") for single notes, s("<name>:mute") for palm-muted notes and s("<name>:chord") for strummed chords; play a drum kit's pieces as s("<name>_kick <name>_snare"), with <name>_tomhi, <name>_tommid, <name>_tomlow, <name>_hatclosed, <name>_hatopen, <name>_ride and <name>_crash. Name a designed instrument in the code only if it is in "instruments" or the preset list. Design one only where it suits the piece better than an existing sound; otherwise leave "instruments" empty.

Answer in JSON with "explanation", a few sentences on what you wrote or found, "code", the program, and "instruments", the instruments you designed.`

/** What the Compose tab says about a designed instrument, before and while the answer is applied. */
export const STRUDEL_COMPOSER_INSTRUMENT_STATUS_LABELS = {
  pending: 'Made when the code is applied',
  creating: 'Designing the sound...',
  ready: 'Ready',
  existed: 'Already exists, kept as it is',
  failed: 'Not made'
}
