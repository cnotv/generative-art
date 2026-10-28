import {
  TAB_BEAM_BEATS,
  TAB_BEATS_PER_BAR,
  TAB_STEM_NOTE_REACH_RATIO,
  TAB_TRIPLET_DENOMINATOR,
  TAB_TRIPLET_NUMERATOR
} from '../../config'
import type { TabBarSpan, TabEvent, TabGlyph, TabStem } from '../../types'
import { midiNoteToName } from '../pitch'
import { groupRuns } from './imageProbes'

const BEAT_TOLERANCE = 0.01

type DraftEvent = {
  x: number
  beats: number | null
  glyphs: TabGlyph[]
}

export type BarReading = {
  events: TabEvent[]
  unreadableFrets: number
  beatsWritten: number
}

const stemBeats = (stem: TabStem): number =>
  stem.isTriplet
    ? (TAB_BEAM_BEATS[stem.beams] * TAB_TRIPLET_NUMERATOR) / TAB_TRIPLET_DENOMINATOR
    : TAB_BEAM_BEATS[stem.beams]

const noteNamesOf = (glyphs: TabGlyph[], openStrings: number[]): string[] =>
  glyphs.flatMap((glyph) =>
    glyph.fret === null ? [] : [midiNoteToName(openStrings[glyph.lineIndex] + glyph.fret)]
  )

// Notes with no stem above them, such as a held whole note, grouped by column. They get no
// length yet; they share whatever the stemmed notes leave of the bar.
const stemlessDrafts = (glyphs: TabGlyph[], stems: TabStem[], reach: number): DraftEvent[] => {
  const orphans = glyphs
    .filter((glyph) => !stems.some((stem) => Math.abs(stem.x - glyph.centerX) <= reach))
    .toSorted((first, second) => first.centerX - second.centerX)
  const columns = groupRuns(
    orphans.map((glyph) => Math.round(glyph.centerX)),
    Math.round(reach)
  )
  return columns.map((column) => ({
    x: column[0],
    beats: null,
    glyphs: orphans.filter(
      (glyph) =>
        Math.round(glyph.centerX) >= column[0] && Math.round(glyph.centerX) <= column.at(-1)!
    )
  }))
}

const stemDrafts = (glyphs: TabGlyph[], stems: TabStem[], reach: number): DraftEvent[] =>
  stems.map((stem) => ({
    x: stem.x,
    beats: stemBeats(stem),
    glyphs: glyphs.filter((glyph) => Math.abs(stem.x - glyph.centerX) <= reach)
  }))

const shareLeftoverBeats = (drafts: DraftEvent[]): DraftEvent[] => {
  const used = drafts.reduce((total, draft) => total + (draft.beats ?? 0), 0)
  const freeCount = drafts.filter((draft) => draft.beats === null).length
  const share = freeCount === 0 ? 0 : Math.max(0, TAB_BEATS_PER_BAR - used) / freeCount
  return drafts.map((draft) => ({ ...draft, beats: draft.beats ?? share }))
}

// A stem with no number under it is the end of a tie: the previous note just rings on.
const mergeTies = (drafts: DraftEvent[], openStrings: number[]): TabEvent[] =>
  drafts.reduce<TabEvent[]>((events, draft) => {
    const beats = draft.beats ?? 0
    const previous = events.at(-1)
    return draft.glyphs.length === 0 && previous !== undefined
      ? [...events.slice(0, -1), { ...previous, beats: previous.beats + beats }]
      : [...events, { notes: noteNamesOf(draft.glyphs, openStrings), beats }]
  }, [])

/**
 * One bar's notes and lengths. Each stem is a struck note or chord, its beams give its length,
 * and a bar that comes up short is filled out with a rest so the bars stay in step.
 * @param span - where the bar sits on the page
 * @param stems - the stems of the whole staff
 * @param glyphs - the fret numbers of the whole staff
 * @param options - the string set to name notes by and the staff's line gap
 * @param options.openStrings - the MIDI note of each open string, from the top line down
 * @param options.gap - the staff's line gap in pixels
 * @returns the events and how well they fill the bar
 */
export const readBar = (
  span: TabBarSpan,
  stems: TabStem[],
  glyphs: TabGlyph[],
  options: { openStrings: number[]; gap: number }
): BarReading => {
  const inBar = (x: number): boolean => x >= span.startX && x < span.endX
  const barStems = stems.filter((stem) => inBar(stem.x))
  const barGlyphs = glyphs.filter((glyph) => inBar(glyph.centerX))
  const reach = TAB_STEM_NOTE_REACH_RATIO * options.gap
  const drafts = shareLeftoverBeats(
    [
      ...stemDrafts(barGlyphs, barStems, reach),
      ...stemlessDrafts(barGlyphs, barStems, reach)
    ].toSorted((first, second) => first.x - second.x)
  )
  const events = mergeTies(drafts, options.openStrings)
  const beatsWritten = events.reduce((total, event) => total + event.beats, 0)
  const shortBy = TAB_BEATS_PER_BAR - beatsWritten
  return {
    events: shortBy > BEAT_TOLERANCE ? [...events, { notes: [], beats: shortBy }] : events,
    unreadableFrets: barGlyphs.filter((glyph) => glyph.fret === null).length,
    beatsWritten
  }
}
