import { SCORE_SOUND } from '../config'
import type { ScoreTranscription, TabEvent } from '../types'
import { formatBarSequence } from './generateStrudelCode'
import { formatTabBar } from './generateTabCode'

const handLine = (label: string, bars: TabEvent[][]): string[] => {
  const isSilent = bars.every((bar) => bar.every((event) => event.notes.length === 0))
  return isSilent
    ? []
    : [`// ${label}`, `$: note("${formatBarSequence(bars.map(formatTabBar))}").s("${SCORE_SOUND}")`]
}

/**
 * Strudel code that replays a piano score: the tempo with one bar per cycle, then the right
 * hand and the left hand as two labelled blocks that play together.
 * @param transcription - the bars of both hands read from the score image
 * @param sourceName - file name for the header comment
 * @returns code ready for the editor
 */
export const generateScoreCode = (
  transcription: ScoreTranscription,
  sourceName: string
): string => {
  const safeName = sourceName.replaceAll(/[\n\r]+/g, ' ')
  const hands = [
    ...handLine(
      'right hand',
      transcription.bars.map((bar) => bar.rightHand)
    ),
    ...handLine(
      'left hand',
      transcription.bars.map((bar) => bar.leftHand)
    )
  ]
  return [
    `// Read from the piano score "${safeName}": ${transcription.bars.length} bars`,
    `setcps(${transcription.beatsPerMinute}/60/${transcription.beatsPerBar})`,
    ...(hands.length === 0 ? ['silence'] : hands)
  ].join('\n')
}
