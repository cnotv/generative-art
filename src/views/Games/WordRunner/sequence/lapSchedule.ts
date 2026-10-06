import type { HintLevel, Lap, LapWord } from '../types'

const STRONGER_HINT: Record<HintLevel, HintLevel> = {
  none: 'late',
  late: 'full',
  full: 'full'
}

/**
 * Splits a phrase's word positions into chunks learned one at a time. A trailing chunk of
 * a single word joins the one before it, since one word on its own teaches no order.
 */
export const splitIntoChunks = (wordCount: number, chunkSize: number): number[][] => {
  const chunks = Array.from({ length: Math.ceil(wordCount / chunkSize) }, (_, chunkIndex) =>
    Array.from(
      { length: Math.min(chunkSize, wordCount - chunkIndex * chunkSize) },
      (_, offset) => chunkIndex * chunkSize + offset
    )
  )
  const lastChunk = chunks[chunks.length - 1]
  if (chunks.length < 2 || lastChunk.length > 1) return chunks
  const leadingChunks = chunks.slice(0, -1)
  const previousChunk = leadingChunks[leadingChunks.length - 1]
  return [...leadingChunks.slice(0, -1), [...previousChunk, ...lastChunk]]
}

const lapWords = (
  chunks: number[][],
  chunkCount: number,
  hintFor: (chunk: number) => HintLevel
): LapWord[] =>
  chunks
    .slice(0, chunkCount)
    .flatMap((positions, chunk) =>
      positions.map((position) => ({ position, chunk, hint: hintFor(chunk) }))
    )

const plainLap = (words: LapWord[], shuffled = false): Lap => ({ words, shuffled, attempt: 0 })

/**
 * Lays out the laps that teach a phrase: each new chunk joins the words already learned,
 * first with full hints and then with late ones, while the earlier chunks run unhinted.
 * The run closes with the whole phrase unhinted, then once more with the lanes shuffled.
 */
export const buildLapSchedule = (wordCount: number, chunkSize: number): Lap[] => {
  const chunks = splitIntoChunks(wordCount, chunkSize)
  if (chunks.length === 0) return []

  const learningLaps = chunks.flatMap((_, newChunk) =>
    (['full', 'late'] as const).map((newChunkHint) =>
      plainLap(
        lapWords(chunks, newChunk + 1, (chunk) => (chunk === newChunk ? newChunkHint : 'none'))
      )
    )
  )
  const wholePhrase = lapWords(chunks, chunks.length, () => 'none')

  return [...learningLaps, plainLap(wholePhrase), plainLap(wholePhrase, true)]
}

/** The same lap again, with every chunk that held a mistake one hint level stronger. */
export const buildRetryLap = (lap: Lap, mistakePositions: number[]): Lap => {
  const failedChunks = new Set(
    lap.words.filter((word) => mistakePositions.includes(word.position)).map((word) => word.chunk)
  )
  return {
    shuffled: lap.shuffled,
    attempt: lap.attempt + 1,
    words: lap.words.map((word) =>
      failedChunks.has(word.chunk) ? { ...word, hint: STRONGER_HINT[word.hint] } : word
    )
  }
}
