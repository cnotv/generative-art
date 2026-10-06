import { seededRandomValues } from '@webgamekit/threejs'
import { MAX_SAME_LANE_STREAK } from '../config'
import type { Gate, GateDeal, HintLevel, Lap, Phrase } from '../types'

const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193
const GOLDEN_RATIO_INCREMENT = 0x9e3779b1
const VALUES_PER_GATE = 3

/** A stable 32-bit seed from a phrase id (FNV-1a), so a phrase always lays out the same track. */
export const phraseSeed = (phraseId: string): number =>
  [...phraseId].reduce(
    (hash, character) => Math.imul(hash ^ character.charCodeAt(0), FNV_PRIME) >>> 0,
    FNV_OFFSET_BASIS
  )

// Neighbouring seeds would draw near-identical first values, so each gate gets a seed
// scattered away from its neighbours'.
const gateSeed = (seed: number, position: number): number =>
  (seed ^ Math.imul(position + 1, GOLDEN_RATIO_INCREMENT)) >>> 0

const otherLane = (lane: number, randomValue: number, laneCount: number): number =>
  (lane + 1 + Math.floor(randomValue * (laneCount - 1))) % laneCount

/**
 * The lane holding each word of the phrase. It never changes between laps, which is what
 * turns the word order into a path, and never repeats past the allowed streak.
 */
export const buildCorrectLanes = (seed: number, wordCount: number, laneCount: number): number[] =>
  seededRandomValues(seed, wordCount).reduce<number[]>((lanes, randomValue) => {
    const candidate = Math.floor(randomValue * laneCount)
    const recentLanes = lanes.slice(-MAX_SAME_LANE_STREAK)
    const wouldExtendStreak =
      recentLanes.length === MAX_SAME_LANE_STREAK && recentLanes.every((lane) => lane === candidate)
    return [...lanes, wouldExtendStreak ? otherLane(candidate, randomValue, laneCount) : candidate]
  }, [])

/** Moves every correct word off its usual lane, so the lane pattern alone cannot answer. */
export const buildShuffledLanes = (
  seed: number,
  usualLanes: number[],
  laneCount: number
): number[] => {
  const randomValues = seededRandomValues(seed, usualLanes.length)
  return usualLanes.map((lane, position) => otherLane(lane, randomValues[position], laneCount))
}

const pickFrom = (pool: string[], randomValue: number): string | undefined =>
  pool[Math.floor(randomValue * pool.length)]

const uniqueTexts = (texts: string[], excluded: string[]): string[] =>
  [...new Set(texts)].filter((text) => !excluded.includes(text))

/**
 * Picks the wrong answers for one gate: a word from elsewhere in the phrase, preferring a
 * later one so that knowing the words out of order still fails, then one of the word's own
 * look-alikes, then whatever the phrase and the fallback pool still have.
 */
const pickDecoys = (
  phrase: Phrase,
  position: number,
  decoyCount: number,
  randomValues: number[],
  fallbackPool: string[]
): string[] => {
  const { text: correctText, decoys: lookAlikes } = phrase.words[position]
  const phraseTexts = phrase.words.map((word) => word.text)
  const laterTexts = uniqueTexts(phraseTexts.slice(position + 1), [correctText])
  const earlierTexts = uniqueTexts(phraseTexts.slice(0, position), [correctText])
  const orderDecoy = pickFrom(laterTexts.length > 0 ? laterTexts : earlierTexts, randomValues[0])
  const lookAlikeDecoy = pickFrom(
    uniqueTexts(lookAlikes, [correctText, ...(orderDecoy ? [orderDecoy] : [])]),
    randomValues[1]
  )
  const preferred = [orderDecoy, lookAlikeDecoy].filter((text) => text !== undefined)
  const remaining = uniqueTexts(
    [...laterTexts, ...lookAlikes, ...earlierTexts, ...fallbackPool],
    [correctText, ...preferred]
  )
  return [...preferred, ...remaining].slice(0, decoyCount)
}

/** One gate: the correct word in its lane and a decoy in each of the others. */
export const buildGate = (
  { phrase, seed, laneCount, fallbackPool }: GateDeal,
  position: number,
  correctLane: number,
  hint: HintLevel
): Gate => {
  const randomValues = seededRandomValues(gateSeed(seed, position), VALUES_PER_GATE)
  const decoys = pickDecoys(phrase, position, laneCount - 1, randomValues, fallbackPool)
  const rotation = Math.floor(randomValues[2] * Math.max(decoys.length, 1))
  const rotatedDecoys = [...decoys.slice(rotation), ...decoys.slice(0, rotation)]
  const options = Array.from({ length: laneCount }, (_, lane) =>
    lane === correctLane
      ? phrase.words[position].text
      : rotatedDecoys[lane < correctLane ? lane : lane - 1]
  )
  return { position, options, correctLane, hint }
}

/**
 * Every gate of one lap. A plain lap deals each gate exactly as on every other lap; a
 * shuffled lap deals them afresh from the lap's own index, so a retried shuffle is a new one.
 */
export const buildLapGates = (
  deal: GateDeal,
  lap: Lap,
  lapIndex: number,
  correctLanes: number[]
): Gate[] => {
  const lapDeal = lap.shuffled ? { ...deal, seed: (deal.seed + lapIndex + 1) >>> 0 } : deal
  const lanes = lap.shuffled
    ? buildShuffledLanes(lapDeal.seed, correctLanes, deal.laneCount)
    : correctLanes
  return lap.words.map((word) => buildGate(lapDeal, word.position, lanes[word.position], word.hint))
}
