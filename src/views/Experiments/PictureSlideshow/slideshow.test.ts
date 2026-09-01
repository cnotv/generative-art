import { describe, it, expect } from 'vitest'
import {
  advanceSlideshow,
  canvasRoleAt,
  createSlideshowState,
  exitAmountAt,
  gesturePoseAt,
  holdAmountAt,
  slideshowFrame,
  startChange
} from './slideshow'
import type { SlideshowState } from './types'

const TIMING = { hold: 3, release: 1, arrive: 1 }
const SLIDE_COUNT = 6

/** Runs the clock forward in small steps, the way the animation loop does. */
const runFor = (state: SlideshowState, seconds: number): SlideshowState =>
  Array.from({ length: Math.round(seconds / 0.05) }).reduce<SlideshowState>(
    (current) => advanceSlideshow(current, 0.05, TIMING, SLIDE_COUNT),
    state
  )

describe('startChange', () => {
  it('sends the held picture out and brings its neighbour in', () => {
    const changed = startChange(createSlideshowState(), 1, SLIDE_COUNT)

    expect(changed.leavingIndex).toBe(0)
    expect(changed.index).toBe(1)
    expect(changed.direction).toBe(1)
    expect(changed.changeSeconds).toBe(0)
  })

  it('steps backwards to the left', () => {
    const changed = startChange(createSlideshowState(), -1, SLIDE_COUNT)

    expect(changed.index).toBe(SLIDE_COUNT - 1)
    expect(changed.direction).toBe(-1)
  })

  it('wraps past the end of the list in both directions', () => {
    const atLast = { ...createSlideshowState(), index: SLIDE_COUNT - 1 }

    expect(startChange(atLast, 1, SLIDE_COUNT).index).toBe(0)
    expect(startChange(createSlideshowState(), -1, SLIDE_COUNT).index).toBe(SLIDE_COUNT - 1)
  })

  it('ignores a change requested while one is already running', () => {
    const running = startChange(createSlideshowState(), 1, SLIDE_COUNT)
    const interrupted = startChange(running, -1, SLIDE_COUNT)

    expect(interrupted).toBe(running)
  })

  it('restarts the hold clock, so a change is looked at for a full hold', () => {
    const nearlyDue = { ...createSlideshowState(), holdSeconds: TIMING.hold - 0.1 }

    expect(startChange(nearlyDue, 1, SLIDE_COUNT).holdSeconds).toBe(0)
  })
})

describe('advanceSlideshow', () => {
  it('advances on its own once the hold has run out', () => {
    const held = runFor(createSlideshowState(), TIMING.hold - 0.1)
    const advanced = runFor(createSlideshowState(), TIMING.hold + 0.1)

    expect(held.changeSeconds).toBeNull()
    expect(advanced.changeSeconds).not.toBeNull()
    expect(advanced.index).toBe(1)
  })

  it('advances to the right when nobody asked for a direction', () => {
    expect(runFor(createSlideshowState(), TIMING.hold + 0.1).direction).toBe(1)
  })

  it('settles back into a hold once the change has run its course', () => {
    const settled = runFor(startChange(createSlideshowState(), 1, SLIDE_COUNT), 2.2)

    expect(settled.changeSeconds).toBeNull()
    expect(settled.index).toBe(1)
    // Only the 0.2s past the end of the change counts towards the next one.
    expect(settled.holdSeconds).toBeCloseTo(0.2)
  })

  it('keeps stepping one picture at a time when left alone', () => {
    const cycle = TIMING.hold + TIMING.release + TIMING.arrive
    const afterThree = runFor(createSlideshowState(), cycle * 3 + 0.5)

    expect(afterThree.index).toBe(3)
  })
})

describe('slideshowFrame', () => {
  it.each([
    ['holding', 0, 'hold'],
    ['releasing', 0.5, 'release'],
    ['arriving', 1.5, 'arrive']
  ])('reports %s', (_label, changeSeconds, phase) => {
    const state = { ...startChange(createSlideshowState(), 1, SLIDE_COUNT) }
    const running = changeSeconds === 0 ? createSlideshowState() : { ...state, changeSeconds }

    expect(slideshowFrame(running, TIMING).phase).toBe(phase)
  })

  it('empties both hands while the old picture is on its way out', () => {
    const releasing = { ...startChange(createSlideshowState(), 1, SLIDE_COUNT), changeSeconds: 0.5 }
    const frame = slideshowFrame(releasing, TIMING)

    expect(frame.heldIndex).toBeNull()
    expect(frame.leavingIndex).toBe(0)
  })

  it('carries the arriving picture in the hands, with the old one still leaving', () => {
    const arriving = { ...startChange(createSlideshowState(), 1, SLIDE_COUNT), changeSeconds: 1.5 }
    const frame = slideshowFrame(arriving, TIMING)

    expect(frame.heldIndex).toBe(1)
    expect(frame.leavingIndex).toBe(0)
  })

  it('keeps the released picture travelling for the whole change, not just the release', () => {
    const arriving = { ...startChange(createSlideshowState(), 1, SLIDE_COUNT), changeSeconds: 1.5 }

    expect(slideshowFrame(arriving, TIMING).leftSeconds).toBeCloseTo(1.5)
  })

  it('carries the direction through, so the scene knows which way to throw', () => {
    const leftwards = {
      ...startChange(createSlideshowState(), -1, SLIDE_COUNT),
      changeSeconds: 0.5
    }

    expect(slideshowFrame(leftwards, TIMING).direction).toBe(-1)
  })
})

describe('holdAmountAt', () => {
  const amountAt = (changeSeconds: number | null) =>
    holdAmountAt(
      slideshowFrame(
        changeSeconds === null
          ? createSlideshowState()
          : { ...startChange(createSlideshowState(), 1, SLIDE_COUNT), changeSeconds },
        TIMING
      )
    )

  it.each([
    ['stays raised through the hold', null, 1],
    ['is fully raised as the release opens', 0, 1],
    ['is empty by the end of the release', 0.999, 0],
    ['is still empty as the arrival opens', 1.001, 0],
    ['is holding again by the end of the arrival', 1.999, 1]
  ])('%s', (_label, changeSeconds, expected) => {
    expect(amountAt(changeSeconds as number | null)).toBeCloseTo(expected as number, 2)
  })

  it('falls through the release and rises through the arrival, without reversing', () => {
    const release = Array.from({ length: 20 }, (_, step) => amountAt(step * 0.05))
    const arrive = Array.from({ length: 20 }, (_, step) => amountAt(1 + step * 0.05))

    expect(release.every((value, index) => index === 0 || value <= release[index - 1])).toBe(true)
    expect(arrive.every((value, index) => index === 0 || value >= arrive[index - 1])).toBe(true)
  })
})

describe('exitAmountAt', () => {
  const exitAt = (changeSeconds: number) =>
    exitAmountAt(
      slideshowFrame(
        { ...startChange(createSlideshowState(), 1, SLIDE_COUNT), changeSeconds },
        TIMING
      ),
      TIMING
    )

  it('starts in the hands', () => {
    expect(exitAt(0)).toBe(0)
  })

  it('is flung rather than travelling at a constant rate', () => {
    expect(exitAt(1)).toBeGreaterThan(exitAt(0.5) * 2)
  })

  it('is still travelling through the arrival, and is all the way out by the end', () => {
    expect(exitAt(1.5)).toBeGreaterThan(exitAt(1))
    expect(exitAt(2)).toBeCloseTo(1)
  })
})

describe('gesturePoseAt', () => {
  const poseAt = (changeSeconds: number | null, direction: 1 | -1 = 1) =>
    gesturePoseAt(
      slideshowFrame(
        changeSeconds === null
          ? createSlideshowState()
          : { ...startChange(createSlideshowState(), direction, SLIDE_COUNT), changeSeconds },
        TIMING
      )
    )

  it('rests fully on the hold loop while nothing is changing', () => {
    expect(poseAt(null)).toMatchObject({ holdWeight: 1, pushWeight: 0 })
  })

  it('carries the direction a throw started with', () => {
    expect(poseAt(0.5, -1).direction).toBe(-1)
  })

  it.each([
    ['is fully on the hold loop the instant release opens', 0, 0, 1],
    ['is fully on the push clip by a fifth into release', TIMING.release * 0.2, 1, 0],
    ['stays fully on the push clip for the rest of release', TIMING.release * 0.99, 1, 0],
    [
      'stays fully on the push clip for most of arrive',
      TIMING.release + TIMING.arrive * 0.79,
      1,
      0
    ],
    [
      'is fully back on the hold loop by the end of arrive',
      TIMING.release + TIMING.arrive * 0.999,
      0,
      1
    ]
  ])('%s', (_label, changeSeconds, expectedPushWeight, expectedHoldWeight) => {
    const pose = poseAt(changeSeconds)

    expect(pose.pushWeight).toBeCloseTo(expectedPushWeight, 2)
    expect(pose.holdWeight).toBeCloseTo(expectedHoldWeight, 2)
  })

  it('scrubs the push clip forward through release', () => {
    const early = poseAt(TIMING.release * 0.3).pushProgress
    const late = poseAt(TIMING.release * 0.9).pushProgress

    expect(late).toBeGreaterThan(early)
  })

  it('scrubs the push clip backward through arrive, ending where release began', () => {
    const start = poseAt(TIMING.release + 0.001).pushProgress
    const end = poseAt(TIMING.release + TIMING.arrive * 0.999).pushProgress

    expect(start).toBeGreaterThan(end)
    expect(end).toBeCloseTo(0, 1)
  })

  it('is continuous across the release-to-arrive boundary, with nothing to pop', () => {
    const endOfRelease = poseAt(TIMING.release - 0.001)
    const startOfArrive = poseAt(TIMING.release + 0.001)

    expect(startOfArrive.pushProgress).toBeCloseTo(endOfRelease.pushProgress, 1)
    expect(startOfArrive.pushWeight).toBeCloseTo(endOfRelease.pushWeight, 2)
  })
})

describe('canvasRoleAt', () => {
  it('gives the held picture no other role while nothing is moving', () => {
    const frame = slideshowFrame(createSlideshowState(), TIMING)

    expect(canvasRoleAt(frame, 0)).toBe('held')
    expect(canvasRoleAt(frame, 1)).toBe('hidden')
  })

  it.each([
    ['the picture on its way out', 0, 'leaving'],
    ['the picture on its way in', 1, 'arriving'],
    ['a picture with no part in this change', 4, 'hidden']
  ])('reads %s', (_label, index, role) => {
    const arriving = { ...startChange(createSlideshowState(), 1, SLIDE_COUNT), changeSeconds: 1.5 }

    expect(canvasRoleAt(slideshowFrame(arriving, TIMING), index as number)).toBe(role)
  })

  it('never gives one picture two roles in the same frame', () => {
    const samples = Array.from({ length: 60 }, (_, step) => step * 0.05)

    samples.forEach((changeSeconds) => {
      const frame = slideshowFrame(
        { ...startChange(createSlideshowState(), 1, SLIDE_COUNT), changeSeconds },
        TIMING
      )
      const roles = Array.from({ length: SLIDE_COUNT }, (_, index) => canvasRoleAt(frame, index))

      expect(roles.filter((role) => role !== 'hidden').length).toBeLessThanOrEqual(2)
    })
  })
})
