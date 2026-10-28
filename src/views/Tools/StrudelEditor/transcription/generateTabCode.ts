import { TAB_SOUNDS } from '../config'
import type { TabEvent, TabTranscription } from '../types'
import { formatBarSequence } from './generateStrudelCode'

const REST = '~'
const WEIGHT_UNITS_PER_BEAT = 24

const greatestCommonDivisor = (first: number, second: number): number =>
  second === 0 ? first : greatestCommonDivisor(second, first % second)

const noteToken = (notes: string[]): string => {
  if (notes.length === 0) {
    return REST
  }
  return notes.length === 1 ? notes[0] : `[${notes.join(',')}]`
}

/**
 * Mini-notation for one bar. Each event's length becomes an "@" weight; weights are counted in
 * 24ths of a beat so eighths, sixteenths and triplets stay whole numbers, then divided by their
 * common factor to keep the bar short to read.
 * @param events - the bar's notes in order
 * @returns the bar as space separated steps
 */
export const formatTabBar = (events: TabEvent[]): string => {
  const weights = events.map((event) =>
    Math.max(1, Math.round(event.beats * WEIGHT_UNITS_PER_BEAT))
  )
  const divisor = weights.reduce(greatestCommonDivisor)
  return events
    .map((event, index) => {
      const weight = weights[index] / divisor
      return `${noteToken(event.notes)}${weight > 1 ? `@${weight}` : ''}`
    })
    .join(' ')
}

/**
 * Strudel code that replays a tab: the tempo, then one bar per cycle on the instrument's sound.
 * @param transcription - the bars read from the tab image
 * @param sourceName - file name for the header comment
 * @returns code ready for the editor
 */
export const generateTabCode = (transcription: TabTranscription, sourceName: string): string => {
  const safeName = sourceName.replaceAll(/[\n\r]+/g, ' ')
  const header = [
    `// Read from the ${transcription.instrument} tab "${safeName}": ${transcription.bars.length} bars`,
    `setcps(${transcription.beatsPerMinute}/60/4)`
  ]
  const isSilent = transcription.bars.every((bar) => bar.every((event) => event.notes.length === 0))
  if (isSilent) {
    return [...header, 'silence'].join('\n')
  }
  const pattern = formatBarSequence(transcription.bars.map(formatTabBar))
  return [...header, `note("${pattern}").s("${TAB_SOUNDS[transcription.instrument]}")`].join('\n')
}
