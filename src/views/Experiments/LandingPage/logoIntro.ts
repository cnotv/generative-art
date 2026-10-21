import type { CoordinateTuple } from '@webgamekit/threejs'
import {
  INTRO_TIMING,
  EYE_OPEN_DURATION,
  BLINK_START,
  BLINK_DURATION,
  ANTICIPATION_LEAN,
  AIR_LEAN,
  ARC_HEIGHT,
  SETTLE_ROCK,
  SETTLE_FREQUENCY,
  SETTLE_DAMPING,
  SLEEP_YAW
} from './config'
import type { LogoJumpPath, LogoIntroPose } from './types'

type PhaseShape = Pick<LogoIntroPose, 'feet' | 'tilt' | 'yaw'>
type Phase = { duration: number; shape: (progress: number, path: LogoJumpPath) => PhaseShape }

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))
const easeOutCubic = (progress: number): number => 1 - (1 - progress) ** 3
const smoothStep = (progress: number): number => progress * progress * (3 - 2 * progress)
const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress

const getTravelDirection = ({ start, end }: LogoJumpPath): number =>
  Math.sign(end[0] - start[0]) || 1

const getArcFeet = ({ start, end }: LogoJumpPath, progress: number): CoordinateTuple => {
  const lift = (ARC_HEIGHT + Math.abs(end[1] - start[1]) / 2) * 4 * progress * (1 - progress)
  return [
    lerp(start[0], end[0], progress),
    lerp(start[1], end[1], progress) + lift,
    lerp(start[2], end[2], progress)
  ]
}

// Anticipation, a lean into the flight and a damped rock on landing are the cartoon jump beats
// kept here; the shape itself never squashes. Each phase only describes its own slice.
const PHASES: Phase[] = [
  {
    duration: INTRO_TIMING.wake,
    shape: (_, path) => ({ feet: path.start, tilt: 0, yaw: SLEEP_YAW })
  },
  {
    duration: INTRO_TIMING.anticipation,
    shape: (progress, path) => ({
      feet: path.start,
      tilt: getTravelDirection(path) * ANTICIPATION_LEAN * easeOutCubic(progress),
      yaw: SLEEP_YAW
    })
  },
  {
    duration: INTRO_TIMING.air,
    shape: (progress, path) => ({
      feet: getArcFeet(path, progress),
      tilt: -getTravelDirection(path) * AIR_LEAN * (1 - progress),
      yaw: lerp(SLEEP_YAW, 0, smoothStep(progress))
    })
  },
  {
    duration: INTRO_TIMING.settle,
    shape: (progress, path) => {
      const seconds = progress * INTRO_TIMING.settle
      const rock = Math.sin(SETTLE_FREQUENCY * seconds) * Math.exp(-SETTLE_DAMPING * seconds)
      return { feet: path.end, tilt: getTravelDirection(path) * SETTLE_ROCK * rock, yaw: 0 }
    }
  }
]

const TOTAL_DURATION = PHASES.reduce((sum, { duration }) => sum + duration, 0)

const getEyeOpenness = (elapsed: number): number => {
  if (elapsed < EYE_OPEN_DURATION) return easeOutCubic(elapsed / EYE_OPEN_DURATION)
  const blinkProgress = (elapsed - BLINK_START) / BLINK_DURATION
  if (blinkProgress > 0 && blinkProgress < 1) return 1 - Math.sin(Math.PI * blinkProgress)
  return 1
}

const findActivePhase = (elapsed: number): { phase: Phase; progress: number } => {
  const found = PHASES.reduce<{ phase: Phase; start: number } | null>((active, phase, index) => {
    const start = PHASES.slice(0, index).reduce((sum, { duration }) => sum + duration, 0)
    return active ?? (elapsed < start + phase.duration ? { phase, start } : null)
  }, null)
  if (!found) return { phase: PHASES[PHASES.length - 1], progress: 1 }
  return { phase: found.phase, progress: clamp01((elapsed - found.start) / found.phase.duration) }
}

/**
 * The logo's pose while it wakes up in the corner and jumps to the centre.
 * @param elapsed Seconds since the logo was clicked awake.
 * @param path Where its feet start and land.
 * @returns Feet position, lean, turn, eye openness and how far the lights have come up.
 */
export const getLogoIntroPose = (elapsed: number, path: LogoJumpPath): LogoIntroPose => {
  if (elapsed >= TOTAL_DURATION) {
    return { feet: path.end, tilt: 0, yaw: 0, eyeOpenness: 1, lightProgress: 1, done: true }
  }
  const { phase, progress } = findActivePhase(elapsed)
  return {
    ...phase.shape(progress, path),
    eyeOpenness: getEyeOpenness(elapsed),
    lightProgress: smoothStep(
      clamp01((elapsed - INTRO_TIMING.wake) / (TOTAL_DURATION - INTRO_TIMING.wake))
    ),
    done: false
  }
}

/**
 * The logo asleep in the corner, turned towards the room with its back to the wall.
 * @param path Where its feet rest.
 * @returns The resting pose with closed eyes and the room dark.
 */
export const getSleepPose = (path: LogoJumpPath): LogoIntroPose => ({
  feet: path.start,
  tilt: 0,
  yaw: SLEEP_YAW,
  eyeOpenness: 0,
  lightProgress: 0,
  done: false
})
