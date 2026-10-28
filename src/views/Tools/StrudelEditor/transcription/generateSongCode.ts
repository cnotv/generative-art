import {
  IMPORT_CODE_PLAIN,
  SCORE_SOUND,
  STRUDEL_DEFAULT_BEATS_PER_MINUTE,
  TAB_BEATS_PER_BAR,
  TAB_SOUNDS
} from '../config'
import type {
  ImportCodeOptions,
  ImportedSong,
  ImportedTranscription,
  SongInstrument,
  SongSource
} from '../types'
import { generateScoreCode } from './generateScoreCode'
import {
  generateTabCode,
  greatestCommonDivisor,
  instrumentPattern,
  isSilentBars,
  safeFileName,
  tempoLine
} from './generateTabCode'

type UnlabelledInstrument = Omit<SongInstrument, 'label'> & { kindLabel: string }

const beatsPerBarOf = (source: SongSource): number =>
  source.transcription.kind === 'score' ? source.transcription.beatsPerBar : TAB_BEATS_PER_BAR

const sourceDescription = (source: SongSource): string =>
  source.transcription.kind === 'score' ? 'piano score' : `${source.transcription.instrument} tab`

const headerName = (source: SongSource): string =>
  `${source.transcription.kind === 'score' ? 'piano score' : source.transcription.instrument} "${safeFileName(source.sourceName)}"`

// A score plays as two instruments, one per hand; a hand that only rests is left out.
const instrumentsOf = (source: SongSource, sourceIndex: number): UnlabelledInstrument[] => {
  const shared = { sourceName: source.sourceName, sourceIndex }
  const { transcription } = source
  if (transcription.kind === 'tab') {
    return [
      {
        ...shared,
        kindLabel: transcription.instrument,
        sound: TAB_SOUNDS[transcription.instrument],
        bars: transcription.bars
      }
    ]
  }
  return [
    { kindLabel: 'right hand', bars: transcription.bars.map((bar) => bar.rightHand) },
    { kindLabel: 'left hand', bars: transcription.bars.map((bar) => bar.leftHand) }
  ]
    .filter((hand) => !isSilentBars(hand.bars))
    .map((hand) => ({ ...shared, ...hand, sound: SCORE_SOUND }))
}

const labelInstruments = (instruments: UnlabelledInstrument[]): SongInstrument[] =>
  instruments.map(({ kindLabel, ...instrument }, index) => {
    const sameKindBefore = instruments
      .slice(0, index)
      .filter((earlier) => earlier.kindLabel === kindLabel).length
    return {
      ...instrument,
      label: sameKindBefore === 0 ? kindLabel : `${kindLabel} ${sameKindBefore + 1}`
    }
  })

const tempoWarnings = (sources: SongSource[], beatsPerMinute: number): string[] =>
  sources
    .filter((source) => source.transcription.beatsPerMinute !== beatsPerMinute)
    .map(
      (source) =>
        `The ${sourceDescription(source)} "${safeFileName(source.sourceName)}" is marked ${source.transcription.beatsPerMinute} BPM; the song plays at ${beatsPerMinute} BPM, the first file's tempo`
    )

// Every bar fills one cycle, so a bar of fewer beats than the song's is stretched to fit.
const metreWarnings = (sources: SongSource[], beatsPerBar: number): string[] =>
  sources
    .filter((source) => beatsPerBarOf(source) !== beatsPerBar)
    .map(
      (source) =>
        `The ${sourceDescription(source)} "${safeFileName(source.sourceName)}" has ${beatsPerBarOf(source)} beats to the bar, but each bar fills a cycle of ${beatsPerBar}, so it plays ${beatsPerBarOf(source) < beatsPerBar ? 'slower' : 'faster'} than marked`
    )

type LoopLength = { name: string; bars: number }

// A score's hands share one length, so lengths are compared per file, named as the rows are.
const loopLengths = (sources: SongSource[], instruments: SongInstrument[]): LoopLength[] =>
  sources.map((source, sourceIndex) => ({
    name:
      source.transcription.kind === 'score'
        ? 'piano score'
        : (instruments.find((instrument) => instrument.sourceIndex === sourceIndex)?.label ??
          source.transcription.instrument),
    bars: source.transcription.bars.length
  }))

// Each block loops on its own, so two lengths that do not divide line up again only every so often.
const loopWarnings = (lengths: LoopLength[]): string[] =>
  lengths.flatMap((first, index) =>
    lengths.slice(index + 1).flatMap((second) => {
      const longer = Math.max(first.bars, second.bars)
      const shorter = Math.min(first.bars, second.bars)
      if (shorter === 0 || longer % shorter === 0) {
        return []
      }
      const realignBars =
        (first.bars * second.bars) / greatestCommonDivisor(first.bars, second.bars)
      return [
        `The ${first.name} (${first.bars} bars) and ${second.name} (${second.bars} bars) loop at different lengths, so they line up again only every ${realignBars} bars`
      ]
    })
  )

/**
 * The imported files that are tabs or scores, in import order, ready to become a song.
 * @param transcriptions - everything the Import tab read
 * @returns each tab or score with the name of the file it came from
 */
export const toSongSources = (transcriptions: ImportedTranscription[]): SongSource[] =>
  transcriptions.flatMap((entry) =>
    entry.result.kind === 'grid'
      ? []
      : [{ sourceName: entry.sourceName, transcription: entry.result }]
  )

/**
 * Gathers tabs and scores read from several files into one song: the first file sets the tempo
 * and the metre, each tab becomes one instrument and each score one per hand.
 * @param sources - the files in the order they were imported
 * @returns the song with a warning for each tempo, metre or loop length that does not fit
 */
export const createImportedSong = (sources: SongSource[]): ImportedSong => {
  const instruments = labelInstruments(sources.flatMap(instrumentsOf))
  const beatsPerMinute =
    sources[0]?.transcription.beatsPerMinute ?? STRUDEL_DEFAULT_BEATS_PER_MINUTE
  const beatsPerBar = sources[0] === undefined ? TAB_BEATS_PER_BAR : beatsPerBarOf(sources[0])
  return {
    beatsPerMinute,
    beatsPerBar,
    sources,
    instruments,
    warnings: [
      ...tempoWarnings(sources, beatsPerMinute),
      ...metreWarnings(sources, beatsPerBar),
      ...loopWarnings(loopLengths(sources, instruments))
    ]
  }
}

/**
 * The song's instruments as labelled blocks, so Strudel plays them together, without a tempo line.
 * @param song - the instruments to write
 * @param options - whether to draw a visual under each block
 * @returns one commented `$:` block per instrument
 */
export const generateSongBlocks = (
  song: ImportedSong,
  options: ImportCodeOptions = IMPORT_CODE_PLAIN
): string =>
  song.instruments
    .map(
      (instrument) =>
        `// ${instrument.label} "${safeFileName(instrument.sourceName)}": ${instrument.bars.length} bars\n$: ${instrumentPattern(instrument.bars, instrument.sound, options)}`
    )
    .join('\n')

/**
 * Strudel code for a song: one file is written exactly as its own import, several share one
 * tempo line and play as one labelled block per instrument.
 * @param song - the instruments to write
 * @param options - whether to draw a visual under each block
 * @returns code ready for the editor
 */
export const generateSongCode = (
  song: ImportedSong,
  options: ImportCodeOptions = IMPORT_CODE_PLAIN
): string => {
  const [onlySource] = song.sources
  if (song.sources.length === 1) {
    return onlySource.transcription.kind === 'score'
      ? generateScoreCode(onlySource.transcription, onlySource.sourceName, options)
      : generateTabCode(onlySource.transcription, onlySource.sourceName, options)
  }
  return [
    `// Read from ${song.sources.length} images: ${song.sources.map(headerName).join(', ')}`,
    tempoLine(song.beatsPerMinute, song.beatsPerBar),
    generateSongBlocks(song, options)
  ].join('\n')
}
