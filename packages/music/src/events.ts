import type { MusicHap, MusicNoteEvent } from './types'

/** Reduce a hap's value to a single lane label (sound name, note, or string). */
const hapLabel = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if ('s' in record) return String(record.s)
    if ('note' in record) return String(record.note)
  }
  return String(value)
}

/**
 * Map queried Strudel haps onto a seconds timeline as ordered note events,
 * dropping haps with no `whole` span (they have no onset to hit).
 * @param haps - Haps from querying a pattern over a cycle range
 * @param secondsPerCycle - Real seconds each Strudel cycle lasts
 * @returns Note events sorted by start time
 */
export const musicEventsFromHaps = (haps: MusicHap[], secondsPerCycle: number): MusicNoteEvent[] =>
  haps
    .filter((hap): hap is MusicHap & { whole: { begin: number; end: number } } =>
      Boolean(hap.whole)
    )
    .map((hap) => ({
      time: hap.whole.begin * secondsPerCycle,
      duration: (hap.whole.end - hap.whole.begin) * secondsPerCycle,
      value: hapLabel(hap.value)
    }))
    .sort((first, second) => first.time - second.time)
