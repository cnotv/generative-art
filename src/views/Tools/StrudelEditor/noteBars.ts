import type { StrudelFlowNoteBar, StrudelFlowNoteEvent } from '@webgamekit/strudel-flow'
import { STRUDEL_NOTE_BARS_MAX_CYCLES } from './config'
import { isRecordModule, requireCallable, requireRecordModule, toCallable } from './strudelModules'

// Fractions of a cycle are exact in Strudel but arrive here as floats.
const BEAT_PRECISION = 1e6

const roundBeats = (beats: number): number => Math.round(beats * BEAT_PRECISION) / BEAT_PRECISION

type QueriedNote = { note: string; begin: number; end: number }

const readNoteValue = (value: unknown): string | null =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : null

// A hap is Strudel's event: its whole span, its value, and whether this query holds its onset.
const readQueriedNote = (hap: unknown): QueriedNote | null => {
  if (!isRecordModule(hap) || !isRecordModule(hap.whole)) {
    return null
  }
  const hasOnset = toCallable(hap.hasOnset)
  const note = readNoteValue(hap.value)
  if (hasOnset === undefined || Reflect.apply(hasOnset, hap, []) !== true || note === null) {
    return null
  }
  return { note, begin: Number(hap.whole.begin), end: Number(hap.whole.end) }
}

const queryCycle = (pattern: Record<string, unknown>, cycle: number): QueriedNote[] => {
  const queried: unknown = Reflect.apply(requireCallable(pattern.queryArc), pattern, [
    cycle,
    cycle + 1
  ])
  return Array.isArray(queried)
    ? queried.flatMap((hap) => {
        const note = readQueriedNote(hap)
        return note === null ? [] : [note]
      })
    : []
}

// Notes that start and end together are one chord.
const toBar = (notes: QueriedNote[], cycle: number, beatsPerCycle: number): StrudelFlowNoteBar =>
  notes
    .reduce<StrudelFlowNoteEvent[]>((events, { note, begin, end }) => {
      const start = roundBeats((begin - cycle) * beatsPerCycle)
      const beats = roundBeats((end - begin) * beatsPerCycle)
      const chord = events.find((event) => event.start === start && event.beats === beats)
      return chord === undefined
        ? [...events, { notes: [note], start, beats }]
        : events.map((event) =>
            event === chord ? { ...event, notes: [...event.notes, note] } : event
          )
    }, [])
    .toSorted((first, second) => first.start - second.start)

// The shortest run of bars the rest repeat, so `<a b c>` shows three bars and `a b` one.
const repeatingBars = (bars: StrudelFlowNoteBar[]): StrudelFlowNoteBar[] => {
  const signatures = bars.map((bar) => JSON.stringify(bar))
  const period =
    Array.from({ length: bars.length }, (_, index) => index + 1).find((candidate) =>
      signatures.every((signature, index) => signature === signatures[index % candidate])
    ) ?? bars.length
  return bars.slice(0, period)
}

/**
 * Reads a `note("...")` pattern into bars through Strudel's own mini notation parser, so `<>`,
 * `@`, `!`, `*`, rests and chords mean exactly what they mean when the pattern plays. One cycle
 * is one bar.
 * @param pattern - the mini notation
 * @param beatsPerCycle - how many beats one cycle lasts
 * @returns the bars, or none when the pattern cannot be read
 */
export const readStrudelNoteBars = async (
  pattern: string,
  beatsPerCycle: number
): Promise<StrudelFlowNoteBar[]> => {
  try {
    const miniModule = requireRecordModule(await import('@strudel/mini'))
    const parsed: unknown = requireCallable(miniModule.mini)(pattern)
    if (!isRecordModule(parsed)) {
      return []
    }
    const bars = Array.from({ length: STRUDEL_NOTE_BARS_MAX_CYCLES }, (_, cycle) =>
      toBar(queryCycle(parsed, cycle), cycle, beatsPerCycle)
    )
    return bars.every((bar) => bar.length === 0) ? [] : repeatingBars(bars)
  } catch {
    return []
  }
}
