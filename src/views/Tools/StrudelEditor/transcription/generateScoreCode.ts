import { IMPORT_CODE_PLAIN, SCORE_SOUND } from '../config'
import type { ImportCodeOptions, ScoreTranscription, TabEvent } from '../types'
import { instrumentPattern, isSilentBars, safeFileName, tempoLine } from './generateTabCode'

const handLine = (label: string, bars: TabEvent[][], options: ImportCodeOptions): string[] =>
  isSilentBars(bars) ? [] : [`// ${label}`, `$: ${instrumentPattern(bars, SCORE_SOUND, options)}`]

/**
 * Strudel code that replays a piano score: the tempo with one bar per cycle, then the right
 * hand and the left hand as two labelled blocks that play together.
 * @param transcription - the bars of both hands read from the score image
 * @param sourceName - file name for the header comment
 * @param options - whether to draw a visual under each hand
 * @returns code ready for the editor
 */
export const generateScoreCode = (
  transcription: ScoreTranscription,
  sourceName: string,
  options: ImportCodeOptions = IMPORT_CODE_PLAIN
): string => {
  const hands = [
    ...handLine(
      'right hand',
      transcription.bars.map((bar) => bar.rightHand),
      options
    ),
    ...handLine(
      'left hand',
      transcription.bars.map((bar) => bar.leftHand),
      options
    )
  ]
  return [
    `// Read from the piano score "${safeFileName(sourceName)}": ${transcription.bars.length} bars`,
    tempoLine(transcription.beatsPerMinute, transcription.beatsPerBar),
    ...(hands.length === 0 ? ['silence'] : hands)
  ].join('\n')
}
