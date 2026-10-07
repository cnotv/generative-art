import { seededRandomValues } from '@webgamekit/threejs'
import { MAX_SAME_LANE_STREAK } from '../config'
import type { Gate, GateDeal, HintLevel, LevelWord } from '../types'

const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193
const GOLDEN_RATIO_INCREMENT = 0x9e3779b1
const VALUES_PER_GATE = 3

/** A stable 32-bit seed from a level id (FNV-1a), so a level always lays out the same course. */
export const levelSeed = (levelId: string): number =>
  [...levelId].reduce(
    (hash, character) => Math.imul(hash ^ character.charCodeAt(0), FNV_PRIME) >>> 0,
    FNV_OFFSET_BASIS
  )

// Neighbouring seeds would draw near-identical first values, so each gate gets a seed
// scattered away from its neighbours'.
const gateSeed = (seed: number, position: number): number =>
  (seed ^ Math.imul(position + 1, GOLDEN_RATIO_INCREMENT)) >>> 0

/** A lane other than the given one, picked by a random value in [0, 1). */
export const otherLane = (lane: number, randomValue: number, laneCount: number): number =>
  (lane + 1 + Math.floor(randomValue * (laneCount - 1))) % laneCount

/**
 * The lane holding each word of the text. It never changes between attempts, which is what
 * turns the word order into a route, and never repeats past the allowed streak. A word may
 * prefer a lane, the inside of the bend its gate opens onto, and gets it unless that would
 * break the streak; everywhere else the seed decides.
 */
export const buildCorrectLanes = (
  seed: number,
  wordCount: number,
  laneCount: number,
  preferredLanes: Array<number | null> = []
): number[] =>
  seededRandomValues(seed, wordCount).reduce<number[]>((lanes, randomValue, position) => {
    const candidate = preferredLanes[position] ?? Math.floor(randomValue * laneCount)
    const recentLanes = lanes.slice(-MAX_SAME_LANE_STREAK)
    const wouldExtendStreak =
      recentLanes.length === MAX_SAME_LANE_STREAK && recentLanes.every((lane) => lane === candidate)
    return [...lanes, wouldExtendStreak ? otherLane(candidate, randomValue, laneCount) : candidate]
  }, [])

const pickFrom = (pool: string[], randomValue: number): string | undefined =>
  pool[Math.floor(randomValue * pool.length)]

const uniqueTexts = (texts: string[], excluded: string[]): string[] =>
  [...new Set(texts)].filter((text) => !excluded.includes(text))

/**
 * Picks the wrong answers for one gate: a word from elsewhere in the text, preferring a
 * later one so that knowing the words out of order still fails, then one of the word's own
 * look-alikes, then whatever the text and the fallback pool still have.
 */
const pickDecoys = (
  words: LevelWord[],
  position: number,
  decoyCount: number,
  randomValues: number[],
  fallbackPool: string[]
): string[] => {
  const { text: correctText, decoys: lookAlikes } = words[position]
  const texts = words.map((word) => word.text)
  const laterTexts = uniqueTexts(texts.slice(position + 1), [correctText])
  const earlierTexts = uniqueTexts(texts.slice(0, position), [correctText])
  const orderDecoy = pickFrom(laterTexts.length > 0 ? laterTexts : earlierTexts, randomValues[0])
  const lookAlikeDecoy = pickFrom(
    uniqueTexts(lookAlikes, [correctText, ...(orderDecoy ? [orderDecoy] : [])]),
    randomValues[1]
  )
  const preferred = [orderDecoy, lookAlikeDecoy].filter(
    (text): text is string => text !== undefined
  )
  const remaining = uniqueTexts(
    [...laterTexts, ...lookAlikes, ...earlierTexts, ...fallbackPool],
    [correctText, ...preferred]
  )
  return [...preferred, ...remaining].slice(0, decoyCount)
}

/** One gate: the correct word in its lane and a decoy in each of the others. */
export const buildGate = (
  { words, seed, laneCount, fallbackPool }: GateDeal,
  position: number,
  correctLane: number,
  hint: HintLevel
): Gate => {
  const randomValues = seededRandomValues(gateSeed(seed, position), VALUES_PER_GATE)
  const decoys = pickDecoys(words, position, laneCount - 1, randomValues, fallbackPool)
  const rotation = Math.floor(randomValues[2] * Math.max(decoys.length, 1))
  const rotatedDecoys = [...decoys.slice(rotation), ...decoys.slice(0, rotation)]
  const options = Array.from({ length: laneCount }, (_, lane) =>
    lane === correctLane
      ? words[position].text
      : rotatedDecoys[lane < correctLane ? lane : lane - 1]
  )
  return { position, options, correctLane, hint }
}

/** Every gate of the level, each word in its own lane with its own hint. */
export const buildRunGates = (deal: GateDeal, hints: HintLevel[], correctLanes: number[]): Gate[] =>
  deal.words.map((_, position) =>
    buildGate(deal, position, correctLanes[position], hints[position])
  )
