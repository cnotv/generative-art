import { describe, it, expect } from 'vitest'
import { getLogoIntroPose, getSleepPose } from './logoIntro'
import { INTRO_TIMING, SLEEP_YAW } from './config'
import type { LogoJumpPath } from './types'

const path: LogoJumpPath = { start: [-10, -1, -3], end: [0, 1, 0] }
const { wake, anticipation, air, settle } = INTRO_TIMING
const takeOff = wake + anticipation
const touchDown = takeOff + air
const total = touchDown + settle

describe('getLogoIntroPose', () => {
  it('starts in the corner turned towards the room, eyes closed and the room dark', () => {
    // Act
    const pose = getLogoIntroPose(0, path)

    // Assert
    expect(pose.feet).toEqual(path.start)
    expect(pose.yaw).toBe(SLEEP_YAW)
    expect(pose.eyeOpenness).toBe(0)
    expect(pose.lightProgress).toBe(0)
    expect(pose.done).toBe(false)
  })

  it('has its eyes open before it leans back to jump', () => {
    expect(getLogoIntroPose(wake, path).eyeOpenness).toBe(1)
  })

  it('leans back without leaving the corner before take off', () => {
    // Act
    const pose = getLogoIntroPose(takeOff - 0.001, path)

    // Assert
    expect(pose.feet).toEqual(path.start)
    expect(pose.tilt).toBeGreaterThan(0)
  })

  it('rises above both ends of the jump in mid air', () => {
    // Act
    const [x, y] = getLogoIntroPose(takeOff + air / 2, path).feet

    // Assert
    expect(x).toBeCloseTo(-5)
    expect(y).toBeGreaterThan(path.end[1])
  })

  it('leans into the direction of travel while flying right', () => {
    expect(getLogoIntroPose(takeOff + air * 0.1, path).tilt).toBeLessThan(0)
  })

  it.each([
    ['at take off', takeOff, SLEEP_YAW],
    ['on touch down', touchDown, 0]
  ])('turns to face the front during the flight: %s', (_, elapsed, expectedYaw) => {
    expect(getLogoIntroPose(elapsed, path).yaw).toBeCloseTo(expectedYaw)
  })

  it('lands on the landing spot', () => {
    expect(getLogoIntroPose(touchDown + 0.01, path).feet).toEqual(path.end)
  })

  it('rests facing front at the centre once done', () => {
    // Act
    const pose = getLogoIntroPose(total + 0.1, path)

    // Assert
    expect(pose).toEqual({
      feet: path.end,
      tilt: 0,
      yaw: 0,
      eyeOpenness: 1,
      lightProgress: 1,
      done: true
    })
  })
})

describe('getSleepPose', () => {
  it('stays still in the corner with closed eyes', () => {
    // Act
    const poses = [0, 1, 2].map(() => getSleepPose(path))

    // Assert
    poses.forEach((pose) => {
      expect(pose.feet).toEqual(path.start)
      expect(pose.yaw).toBe(SLEEP_YAW)
      expect(pose.eyeOpenness).toBe(0)
    })
  })
})
