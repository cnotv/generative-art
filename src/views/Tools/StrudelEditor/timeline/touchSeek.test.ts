import { describe, expect, it } from 'vitest'
import { cycleAtClientX, movedBeyondSlop } from './touchSeek'

describe('cycleAtClientX', () => {
  it.each([
    { clientX: 400, expected: 4, why: 'the middle of an 8 cycle track' },
    { clientX: 50, expected: 0.5, why: 'half a cycle along' },
    { clientX: 53, expected: 0.5, why: 'a point between steps snaps to the closest one' },
    { clientX: -50, expected: 0, why: 'left of the track clamps to the start' },
    { clientX: 900, expected: 8, why: 'right of the track clamps to the end' }
  ])('returns $expected for x $clientX: $why', ({ clientX, expected }) => {
    // Act
    const cycle = cycleAtClientX({
      clientX,
      trackLeft: 0,
      trackWidth: 800,
      timelineBars: 8,
      seekStep: 0.0625
    })

    // Assert
    expect(cycle).toBe(expected)
  })

  it('returns the start for a track with no width yet', () => {
    // Act
    const cycle = cycleAtClientX({
      clientX: 40,
      trackLeft: 0,
      trackWidth: 0,
      timelineBars: 8,
      seekStep: 0.0625
    })

    // Assert
    expect(cycle).toBe(0)
  })
})

describe('movedBeyondSlop', () => {
  it.each([
    { endX: 104, endY: 50, expected: false, why: 'a small wobble is still a tap' },
    { endX: 130, endY: 50, expected: true, why: 'a sideways swipe is a scroll' },
    { endX: 100, endY: 80, expected: true, why: 'a vertical swipe is not a tap either' }
  ])('is $expected when the touch ends at ($endX, $endY): $why', ({ endX, endY, expected }) => {
    // Act
    const moved = movedBeyondSlop(
      { clientX: 100, clientY: 50 },
      { clientX: endX, clientY: endY },
      8
    )

    // Assert
    expect(moved).toBe(expected)
  })
})
