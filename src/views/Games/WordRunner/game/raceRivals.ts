import { CENTRE_LANE, PROGRESS_INTERVAL_SECONDS, REMOTE_FOLLOW_RATE } from '../config'
import { smoothingFactor } from '../runner/runMotion'
import { createRacer, hopHeight, stepRacer } from '../runner/racer'
import type { RemoteRival, Rival, RivalFrame, Racer, RunSettings } from '../types'

const BOT_NAME = 'the bot'

type RivalStep = {
  baseSpeed: number
  deltaSeconds: number
  elapsedSeconds: number
  finishDistance: number
}

/**
 * Where to draw another player's ball: rolling on at the base speed between reports, at most
 * one report's worth past the last, and eased towards it, so it never jumps. A ball that has
 * finished stays on the line.
 */
export const followRemote = (
  shown: number,
  reported: number,
  baseSpeed: number,
  deltaSeconds: number,
  finished = false
): number => {
  const furthest = finished ? reported : reported + baseSpeed * PROGRESS_INTERVAL_SECONDS
  const predicted = Math.min(furthest, shown + baseSpeed * deltaSeconds)
  return predicted + (reported - predicted) * smoothingFactor(REMOTE_FOLLOW_RATE, deltaSeconds)
}

/** The rival furthest along, or null with no rival at all. */
export const leadingRival = <T extends Rival>(rivals: T[]): T | null =>
  rivals.reduce<T | null>(
    (leader, rival) => (leader === null || rival.distance > leader.distance ? rival : leader),
    null
  )

/**
 * Everyone the player races: the bot in a solo race, run here like the player's own ball,
 * or the other players in a room, drawn where the room last reported them.
 */
export const createRivals = (
  settings: Pick<RunSettings, 'solo' | 'rivals'>,
  throughGates: (moved: Racer, fromDistance: number) => Racer,
  botLaneAt: (distance: number) => number
) => {
  let bot: Racer = createRacer()
  let shown: number[] = []

  const reset = (): void => {
    bot = createRacer()
    shown = []
  }

  const step = (racing: RivalStep): void => {
    if (settings.solo()) {
      bot = throughGates(stepRacer(bot, racing), bot.distance)
      return
    }
    shown = settings
      .rivals()
      .map((rival, index) =>
        followRemote(
          shown[index] ?? 0,
          rival.distance,
          racing.baseSpeed,
          racing.deltaSeconds,
          rival.finishSeconds !== null
        )
      )
  }

  const remote = (): Array<RemoteRival & { shown: number }> =>
    settings.rivals().map((rival, index) => ({ ...rival, shown: shown[index] ?? 0 }))

  /** The rivals as the race result counts them. */
  const standings = (): Rival[] =>
    settings.solo()
      ? [{ name: BOT_NAME, distance: bot.distance, finishSeconds: bot.finishSeconds }]
      : remote().map(({ name, shown: distance, finishSeconds }) => ({
          name,
          distance,
          finishSeconds
        }))

  const frames = (): RivalFrame[] =>
    settings.solo()
      ? [
          {
            distance: bot.distance,
            lane: botLaneAt(bot.distance),
            hop: hopHeight(bot),
            color: null
          }
        ]
      : remote().map((rival) => ({
          distance: rival.shown,
          lane: rival.lane ?? CENTRE_LANE,
          hop: 0,
          color: rival.color
        }))

  return { reset, step, standings, frames }
}
