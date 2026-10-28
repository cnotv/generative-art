import { IMPORT_CODE_PLAIN, IMPORT_VISUAL_CALL, TAB_BEATS_PER_BAR, TAB_SOUNDS } from '../config'
import type { ImportCodeOptions, TabEvent, TabTranscription } from '../types'
import { formatBarSequence } from './generateStrudelCode'

const REST = '~'
const WEIGHT_UNITS_PER_BEAT = 24

/**
 * The largest whole number that divides both.
 * @param first - a whole number
 * @param second - another whole number
 * @returns their greatest common divisor
 */
export const greatestCommonDivisor = (first: number, second: number): number =>
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
 * A file name safe to put in a line comment.
 * @param sourceName - the name of the imported file
 * @returns the name with line breaks turned into spaces
 */
export const safeFileName = (sourceName: string): string => sourceName.replaceAll(/[\n\r]+/g, ' ')

/**
 * The tempo line that makes one bar last one cycle.
 * @param beatsPerMinute - the tempo
 * @param beatsPerBar - the beats in one bar
 * @returns a `setcps` call
 */
export const tempoLine = (beatsPerMinute: number, beatsPerBar: number): string =>
  `setcps(${beatsPerMinute}/60/${beatsPerBar})`

/**
 * Whether bars hold nothing but rests.
 * @param bars - the bars of one instrument
 * @returns true when no note is struck
 */
export const isSilentBars = (bars: TabEvent[][]): boolean =>
  bars.every((bar) => bar.every((event) => event.notes.length === 0))

/**
 * One instrument's bars as a pattern on its sound, one bar per cycle, with the import visual
 * under it when asked for. Rests alone become `silence`, which has nothing to draw.
 * @param bars - the instrument's bars
 * @param sound - the Strudel sound to play them on
 * @param options - whether to draw the visual
 * @returns the pattern expression
 */
export const instrumentPattern = (
  bars: TabEvent[][],
  sound: string,
  options: ImportCodeOptions
): string => {
  if (isSilentBars(bars)) {
    return 'silence'
  }
  const pattern = `note("${formatBarSequence(bars.map(formatTabBar))}").s("${sound}")`
  return options.addVisualizer ? `${pattern}\n  ${IMPORT_VISUAL_CALL}` : pattern
}

/**
 * Strudel code that replays a tab: the tempo, then one bar per cycle on the instrument's sound.
 * @param transcription - the bars read from the tab image
 * @param sourceName - file name for the header comment
 * @param options - whether to draw a visual under the line
 * @returns code ready for the editor
 */
export const generateTabCode = (
  transcription: TabTranscription,
  sourceName: string,
  options: ImportCodeOptions = IMPORT_CODE_PLAIN
): string =>
  [
    `// Read from the ${transcription.instrument} tab "${safeFileName(sourceName)}": ${transcription.bars.length} bars`,
    tempoLine(transcription.beatsPerMinute, TAB_BEATS_PER_BAR),
    instrumentPattern(transcription.bars, TAB_SOUNDS[transcription.instrument], options)
  ].join('\n')
