import { STRUDEL_DEFAULT_BEATS_PER_MINUTE, STRUDEL_VISUAL_REASONS } from '../config'
import type { StrudelCodeFacts, StrudelHint, StrudelMusicStyle } from '../types'

type HintOptions = {
  facts: StrudelCodeFacts
  style: StrudelMusicStyle
}

const tempoRangeText = (style: StrudelMusicStyle): string =>
  `${style.minBeatsPerMinute} to ${style.maxBeatsPerMinute} BPM`

const buildTempoHints = ({ facts, style }: HintOptions): StrudelHint[] => {
  const snippet = `setcps(${style.beatsPerMinute}/60/4)`
  if (facts.tempo === null) {
    return [
      {
        id: 'tempo',
        kind: 'tempo',
        title: `Set the tempo to ${style.beatsPerMinute} BPM`,
        reason: `${style.label} usually runs at ${tempoRangeText(style)}. With no tempo set, Strudel plays at ${STRUDEL_DEFAULT_BEATS_PER_MINUTE}.`,
        snippet
      }
    ]
  }
  const beatsPerMinute = facts.tempo.beatsPerMinute
  if (
    beatsPerMinute === null ||
    (beatsPerMinute >= style.minBeatsPerMinute && beatsPerMinute <= style.maxBeatsPerMinute)
  ) {
    return []
  }
  const isTooSlow = beatsPerMinute < style.minBeatsPerMinute
  return [
    {
      id: 'tempo',
      kind: 'tempo',
      title: `${isTooSlow ? 'Speed up' : 'Slow down'} to ${style.beatsPerMinute} BPM`,
      reason: `${beatsPerMinute} BPM is ${isTooSlow ? 'slow' : 'fast'} for ${style.label}, which usually runs at ${tempoRangeText(style)}.`,
      snippet
    }
  ]
}

const buildInstrumentHints = ({ facts, style }: HintOptions): StrudelHint[] =>
  style.instruments
    .filter((instrument) => !facts.instrumentRoles.includes(instrument.role))
    .map((instrument) => ({
      id: `instrument-${instrument.role}`,
      kind: 'instrument',
      title: `Add ${instrument.label}`,
      reason: instrument.reason,
      snippet: instrument.snippet
    }))

// A visual is chained onto a pattern, so with no pattern there is nothing to draw yet.
const buildVisualHints = ({ facts, style }: HintOptions): StrudelHint[] =>
  facts.patternStatements.length === 0
    ? []
    : style.visuals
        .filter((visualName) => !facts.visualNames.includes(visualName))
        .map((visualName) => ({
          id: `visual-${visualName}`,
          kind: 'visual',
          title: `Draw a ${visualName}`,
          reason: STRUDEL_VISUAL_REASONS[visualName],
          snippet: `._${visualName}()`
        }))

/**
 * What the code is missing for its style: the tempo when it is unset or outside the style's
 * range, then each instrument the style expects and the code lacks, then the visuals that suit
 * the style and the code does not draw.
 * @param options - the code's facts and its style
 * @returns the hints, in that order, empty when nothing is missing
 */
export const buildStrudelHints = (options: HintOptions): StrudelHint[] => [
  ...buildTempoHints(options),
  ...buildInstrumentHints(options),
  ...buildVisualHints(options)
]
