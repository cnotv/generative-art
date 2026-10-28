import {
  MIDI_DEFAULT_BEATS_PER_MINUTE,
  TAB_BEATS_PER_BAR,
  TAB_INSTRUMENT_BY_LINE_COUNT
} from '../../config'
import type { TabImage, TabTranscription } from '../../types'
import { findBarSpans } from './barLines'
import { findFretGlyphs } from './fretGlyphs'
import { readBar, type BarReading } from './readBar'
import { readTempo } from './readTempo'
import { findStems } from './rhythmRow'
import { findStaffSystems, lineGapOf } from './staffLines'

const BEAT_TOLERANCE = 0.01

const warningsFor = (readings: BarReading[]): string[] => {
  const unreadable = readings.reduce((total, reading) => total + reading.unreadableFrets, 0)
  const offBars = readings.flatMap((reading, index) =>
    Math.abs(reading.beatsWritten - TAB_BEATS_PER_BAR) > BEAT_TOLERANCE
      ? [
          `Bar ${index + 1} holds ${Math.round(reading.beatsWritten * 100) / 100} beats, not ${TAB_BEATS_PER_BAR}`
        ]
      : []
  )
  return [
    ...(unreadable > 0 ? [`${unreadable} fret numbers could not be read and were skipped`] : []),
    ...offBars
  ]
}

/**
 * Reads a tab screenshot: the staves, their bars, the fret numbers and the rhythm row under
 * each staff, and turns them into notes with lengths. Plain image processing, no model.
 * @param image - the tab image
 * @returns the bars of notes, or an error when no staff is found
 */
export const readTab = (image: TabImage): TabTranscription => {
  const systems = findStaffSystems(image)
  if (systems.length === 0) {
    throw new Error('No four or six line tab staff was found in the image')
  }
  const instrument = TAB_INSTRUMENT_BY_LINE_COUNT[systems[0].lineYs.length]
  const readings = systems.flatMap((system) => {
    const stems = findStems(image, system)
    const glyphs = findFretGlyphs(image, system)
    const gap = lineGapOf(system)
    return findBarSpans(image, system).map((span) =>
      readBar(span, stems, glyphs, { instrument, gap })
    )
  })
  return {
    kind: 'tab',
    beatsPerMinute: readTempo(image, systems[0]) ?? MIDI_DEFAULT_BEATS_PER_MINUTE,
    instrument,
    bars: readings.map((reading) => reading.events),
    warnings: warningsFor(readings)
  }
}
