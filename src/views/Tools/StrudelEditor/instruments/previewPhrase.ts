import { INSTRUMENT_PREVIEW_PHRASES } from './config'
import type { InstrumentPreset } from './types'
import type { StrudelPreviewHit } from '../types'

const SECONDS_DECIMALS = 6
const PHRASE_TAIL_SECONDS = 0.5

/**
 * The preview phrase for a preset's kind, with each articulation spelt as the preset's sound.
 * @param preset - the preset to preview
 * @returns hits ready for the preview player
 */
export const buildInstrumentPreviewHits = (preset: InstrumentPreset): StrudelPreviewHit[] =>
  INSTRUMENT_PREVIEW_PHRASES[preset.kind].map(({ articulation, ...hit }) => ({
    ...hit,
    sound: `${preset.name}_${articulation}`
  }))

const roundSeconds = (value: number): number => Number(value.toFixed(SECONDS_DECIMALS))

const writeHit = (hit: StrudelPreviewHit, phraseSeconds: number): string => {
  const noteCall = hit.note === undefined ? '' : `note("${hit.note}")`
  const start = roundSeconds(hit.offsetSeconds / phraseSeconds)
  const end = roundSeconds((hit.offsetSeconds + hit.durationSeconds) / phraseSeconds)
  return `  ${noteCall}${noteCall === '' ? '' : '.'}s("${hit.sound}").gain(${hit.gain}).clip(1).compress(${start}, ${end})`
}

/**
 * The same phrase as Strudel code, one cycle long, so the offline renderer produces exactly what
 * the preview plays: each hit is squeezed into the span it sounds in and cut at its end.
 * @param preset - the preset to preview
 * @returns code that renders the phrase in one cycle
 */
export const buildInstrumentPreviewCode = (preset: InstrumentPreset): string => {
  const hits = buildInstrumentPreviewHits(preset)
  const phraseSeconds = Math.max(
    ...hits.map(({ offsetSeconds, durationSeconds }) => offsetSeconds + durationSeconds)
  )
  return `// ${preset.name} preview
setcps(${roundSeconds(1 / (phraseSeconds + PHRASE_TAIL_SECONDS))})
$: stack(
${hits.map((hit) => writeHit(hit, phraseSeconds + PHRASE_TAIL_SECONDS)).join(',\n')}
)
`
}
