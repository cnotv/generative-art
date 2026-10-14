import { otherLane } from '../sequence/gateLayout'
import type { Gate } from '../types'

/**
 * The lane the bot takes at each gate: the right word as often as its accuracy says, and
 * otherwise one of the wrong ones. Two random values per gate, so the same values always
 * plan the same race.
 * @param gates The level's gates.
 * @param accuracy How often the bot picks the right word, from 0 to 1.
 * @param randomValues Two values in [0, 1) per gate.
 * @param laneCount How many lanes the track has.
 * @returns The bot's lane at each gate.
 */
export const planBotLanes = (
  gates: Gate[],
  accuracy: number,
  randomValues: number[],
  laneCount: number
): number[] =>
  gates.map((gate, index) =>
    randomValues[index * 2] < accuracy
      ? gate.correctLane
      : otherLane(gate.correctLane, randomValues[index * 2 + 1], laneCount)
  )
