import { STRUDEL_DEFAULT_BEATS_PER_MINUTE, STRUDEL_VISUAL_REASONS } from '../config'
import type {
  StrudelCodeEdit,
  StrudelCodeFacts,
  StrudelHint,
  StrudelHintContext,
  StrudelMusicStyle
} from '../types'
import { assignVisualTargets } from './assignVisualTargets'
import { playsStyleInstrument } from './playsStyleInstrument'

const tempoRangeText = (style: StrudelMusicStyle): string =>
  `${style.minBeatsPerMinute} to ${style.maxBeatsPerMinute} BPM`

const tempoEdit = (facts: StrudelCodeFacts, snippet: string): StrudelCodeEdit => {
  if (facts.tempo !== null) {
    return { ...facts.tempo.statement, insert: snippet }
  }
  return facts.headerEnd > 0
    ? { from: facts.headerEnd, to: facts.headerEnd, insert: `\n${snippet}` }
    : { from: 0, to: 0, insert: `${snippet}\n` }
}

const buildTempoHints = ({ facts, style }: StrudelHintContext): StrudelHint[] => {
  const snippet = `setcps(${style.beatsPerMinute}/60/4)`
  const beatsPerMinute = facts.tempo?.beatsPerMinute ?? null
  const isInRange =
    beatsPerMinute !== null &&
    beatsPerMinute >= style.minBeatsPerMinute &&
    beatsPerMinute <= style.maxBeatsPerMinute
  if (isInRange || (facts.tempo !== null && beatsPerMinute === null)) {
    return []
  }
  const isTooSlow = beatsPerMinute !== null && beatsPerMinute < style.minBeatsPerMinute
  const tempoHint = {
    id: 'tempo',
    kind: 'tempo' as const,
    snippet,
    actionLabel: 'Add',
    edits: [tempoEdit(facts, snippet)]
  }
  if (beatsPerMinute === null) {
    return [
      {
        ...tempoHint,
        title: `Set the tempo to ${style.beatsPerMinute} BPM`,
        reason: `${style.label} usually runs at ${tempoRangeText(style)}. With no tempo set, Strudel plays at ${STRUDEL_DEFAULT_BEATS_PER_MINUTE}.`
      }
    ]
  }
  return [
    {
      ...tempoHint,
      title: `${isTooSlow ? 'Speed up' : 'Slow down'} to ${style.beatsPerMinute} BPM`,
      reason: `${beatsPerMinute} BPM is ${isTooSlow ? 'slow' : 'fast'} for ${style.label}, which usually runs at ${tempoRangeText(style)}.`
    }
  ]
}

// Once any `$:` block exists Strudel plays only the blocks, so a plain pattern becomes a block
// before the new layer is added as another one.
const newLayerEdits = ({ code, facts }: StrudelHintContext, snippet: string): StrudelCodeEdit[] => {
  const lastPattern = facts.patternStatements.at(-1)
  const blockEdits =
    facts.usesPatternBlocks || lastPattern === undefined
      ? []
      : [{ from: lastPattern.from, to: lastPattern.from, insert: '$: ' }]
  const contentEnd = code.trimEnd().length
  const separator = contentEnd === 0 ? '' : '\n'
  return [...blockEdits, { from: contentEnd, to: code.length, insert: `${separator}$: ${snippet}` }]
}

const buildInstrumentHints = (context: StrudelHintContext): StrudelHint[] =>
  context.style.instruments
    .filter((instrument) => !context.facts.instrumentRoles.includes(instrument.role))
    .map((instrument) => ({
      id: `instrument-${instrument.role}`,
      kind: 'instrument',
      title: `Add ${instrument.label}`,
      reason: instrument.reason,
      snippet: instrument.snippet,
      actionLabel: 'Add',
      edits: newLayerEdits(context, instrument.snippet)
    }))

// A visual with no free layer that suits it is left out rather than stacked onto a layer that
// already draws, where the two would draw over each other, or onto one the review offers to mute.
const buildVisualHints = ({ facts, style }: StrudelHintContext): StrudelHint[] =>
  assignVisualTargets(
    facts.patternStatements.filter((statement) => playsStyleInstrument(statement, style)),
    style.visuals.filter((visualName) => !facts.visualNames.includes(visualName))
  ).map(({ visualName, statement }) => {
    const snippet = `._${visualName}()`
    return {
      id: `visual-${visualName}`,
      kind: 'visual',
      title: `Draw a ${visualName} on line ${statement.line}`,
      reason: STRUDEL_VISUAL_REASONS[visualName],
      snippet,
      actionLabel: 'Add',
      edits: [{ from: statement.to, to: statement.to, insert: snippet }]
    }
  })

/**
 * What the code is missing for its style: the tempo when it is unset or outside the style's
 * range, then each instrument the style expects and the code lacks, then the visuals that suit
 * the style and the code does not draw, each on a layer of its own.
 * @param context - the code, its facts and its style
 * @returns the hints, in that order
 */
export const buildMissingHints = (context: StrudelHintContext): StrudelHint[] => [
  ...buildTempoHints(context),
  ...buildInstrumentHints(context),
  ...buildVisualHints(context)
]
