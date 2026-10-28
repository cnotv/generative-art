import { STRUDEL_DEFAULT_BEATS_PER_MINUTE, TAB_SOUNDS } from '../config'
import type {
  ImportedTranscription,
  TabEvent,
  TabSong,
  TabSongInstrument,
  TabSource,
  TabTranscription
} from '../types'
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
export const generateTabCode = (transcription: TabTranscription, sourceName: string): string =>
  [
    `// Read from the ${transcription.instrument} tab "${safeFileName(sourceName)}": ${transcription.bars.length} bars`,
    tempoLine(transcription.beatsPerMinute),
    tabPattern(transcription)
  ].join('\n')

const safeFileName = (sourceName: string): string => sourceName.replaceAll(/[\n\r]+/g, ' ')

const tempoLine = (beatsPerMinute: number): string => `setcps(${beatsPerMinute}/60/4)`

const tabPattern = (transcription: TabTranscription): string => {
  const isSilent = transcription.bars.every((bar) => bar.every((event) => event.notes.length === 0))
  if (isSilent) {
    return 'silence'
  }
  const pattern = formatBarSequence(transcription.bars.map(formatTabBar))
  return `note("${pattern}").s("${TAB_SOUNDS[transcription.instrument]}")`
}

const instrumentName = (instrument: TabSongInstrument): string =>
  `${instrument.label} "${safeFileName(instrument.sourceName)}"`

const labelInstruments = (sources: TabSource[]): TabSongInstrument[] =>
  sources.map((source, index) => {
    const kind = source.transcription.instrument
    const sameKindBefore = sources
      .slice(0, index)
      .filter((earlier) => earlier.transcription.instrument === kind).length
    return { ...source, label: sameKindBefore === 0 ? kind : `${kind} ${sameKindBefore + 1}` }
  })

const tempoWarnings = (instruments: TabSongInstrument[], beatsPerMinute: number): string[] =>
  instruments
    .filter((instrument) => instrument.transcription.beatsPerMinute !== beatsPerMinute)
    .map(
      (instrument) =>
        `The ${instrument.label} tab "${safeFileName(instrument.sourceName)}" is marked ${instrument.transcription.beatsPerMinute} BPM; the song plays at ${beatsPerMinute} BPM, the first tab's tempo`
    )

// Each block loops on its own, so two lengths that do not divide line up again only every so often.
const loopWarnings = (instruments: TabSongInstrument[]): string[] =>
  instruments.flatMap((first, index) =>
    instruments.slice(index + 1).flatMap((second) => {
      const firstBars = first.transcription.bars.length
      const secondBars = second.transcription.bars.length
      const longer = Math.max(firstBars, secondBars)
      const shorter = Math.min(firstBars, secondBars)
      if (shorter === 0 || longer % shorter === 0) {
        return []
      }
      const realignBars = (firstBars * secondBars) / greatestCommonDivisor(firstBars, secondBars)
      return [
        `The ${first.label} (${firstBars} bars) and ${second.label} (${secondBars} bars) loop at different lengths, so they line up again only every ${realignBars} bars`
      ]
    })
  )

/**
 * The imported files that are tabs, in import order, ready to become a song.
 * @param transcriptions - everything the Import tab read
 * @returns each tab with the name of the file it came from
 */
export const toTabSources = (transcriptions: ImportedTranscription[]): TabSource[] =>
  transcriptions.flatMap((entry) =>
    entry.result.kind === 'tab'
      ? [{ sourceName: entry.sourceName, transcription: entry.result }]
      : []
  )

/**
 * Gathers tabs read from several files into one song: the first tab sets the tempo, and each
 * tab is named for the block it becomes.
 * @param sources - the tabs in the order they were imported
 * @returns the song with a warning for each tempo or loop length that does not fit
 */
export const createTabSong = (sources: TabSource[]): TabSong => {
  const instruments = labelInstruments(sources)
  const beatsPerMinute =
    sources[0]?.transcription.beatsPerMinute ?? STRUDEL_DEFAULT_BEATS_PER_MINUTE
  return {
    beatsPerMinute,
    instruments,
    warnings: [...tempoWarnings(instruments, beatsPerMinute), ...loopWarnings(instruments)]
  }
}

/**
 * The song's tabs as labelled blocks, so Strudel plays them together, without a tempo line.
 * @param song - the tabs to write
 * @returns one commented `$:` block per instrument
 */
export const generateTabSongBlocks = (song: TabSong): string =>
  song.instruments
    .map(
      (instrument) =>
        `// ${instrumentName(instrument)}: ${instrument.transcription.bars.length} bars\n$: ${tabPattern(instrument.transcription)}`
    )
    .join('\n')

/**
 * Strudel code for a song of tabs: one tab is written exactly as a single import, several share
 * one tempo line and play as one labelled block each.
 * @param song - the tabs to write
 * @returns code ready for the editor
 */
export const generateTabSongCode = (song: TabSong): string => {
  const [onlyInstrument] = song.instruments
  if (song.instruments.length === 1) {
    return generateTabCode(onlyInstrument.transcription, onlyInstrument.sourceName)
  }
  return [
    `// Read from ${song.instruments.length} tabs: ${song.instruments.map(instrumentName).join(', ')}`,
    tempoLine(song.beatsPerMinute),
    generateTabSongBlocks(song)
  ].join('\n')
}
