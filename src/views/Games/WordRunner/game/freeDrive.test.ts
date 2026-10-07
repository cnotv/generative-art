import { describe, it, expect } from 'vitest'
import {
  cushionImpulse,
  forwardImpulse,
  gripImpulse,
  needsRescue,
  rescueLateral,
  stalledFor
} from './freeDrive'
import { BRAKE, FREE_BALL } from '../config'

const MASS = 100
const FRAME = 1 / 60
const push = (forwardSpeed: number, braking = false): number =>
  forwardImpulse({ forwardSpeed, speedCap: 12, mass: MASS, deltaSeconds: FRAME, braking })

describe('forwardImpulse', () => {
  it('drives a ball well under its cap at the full drive', () => {
    // Act
    const impulse = push(0)

    // Assert
    expect(impulse).toBeCloseTo(FREE_BALL.driveForce * FRAME)
  })

  it('never pushes a ball close to its cap past it', () => {
    // Act
    const impulse = push(11.9)

    // Assert
    expect(impulse / MASS).toBeCloseTo(0.1)
  })

  it.each([13, 20, 30])('pulls a ball rolling at %i back towards a cap of 12', (forwardSpeed) => {
    // Act
    const impulse = push(forwardSpeed)

    // Assert
    expect(impulse).toBeLessThan(0)
    expect(forwardSpeed + impulse / MASS).toBeGreaterThan(12)
  })

  it('brakes a rolling ball steadily, whatever its cap', () => {
    // Act
    const impulse = push(10, true)

    // Assert
    expect(impulse / MASS).toBeCloseTo(-BRAKE.deceleration * FRAME)
  })

  it.each([
    [0.2, -0.2],
    [0, 0],
    [-0.3, 0.3],
    [-10, BRAKE.deceleration * FRAME]
  ])('brakes a ball at %f towards a stop, rolling back included', (forwardSpeed, change) => {
    // Act
    const impulse = push(forwardSpeed, true)

    // Assert
    expect(impulse / MASS).toBeCloseTo(change)
  })
})

describe('gripImpulse', () => {
  it('takes away part of the sideways speed each frame', () => {
    // Act
    const impulse = gripImpulse(6, MASS, FRAME)

    // Assert
    expect(impulse / MASS).toBeCloseTo(-6 * FREE_BALL.lateralGrip * FRAME)
  })

  it('never more than the whole sideways speed, however long the frame', () => {
    // Act
    const impulse = gripImpulse(6, MASS, 1)

    // Assert
    expect(impulse / MASS).toBeCloseTo(-6)
  })
})

describe('cushionImpulse', () => {
  it.each([0, 3.6, -3.6, 5.1])(
    'leaves a ball %f off centre alone, outer lanes included',
    (lateral) => {
      // Act
      const impulse = cushionImpulse(lateral, 4, MASS, FRAME)

      // Assert
      expect(impulse).toBe(0)
    }
  )

  it.each([
    [6.5, 1],
    [-6.5, -1]
  ])('stops a ball at %f drifting into the wall and pushes it back', (lateral, outwards) => {
    // Act
    const impulse = cushionImpulse(lateral, 3 * outwards, MASS, FRAME)

    // Assert
    expect((3 * outwards + impulse / MASS) * outwards).toBeLessThan(0)
  })

  it('only pushes back, with nothing for its drift, a ball already leaving the wall', () => {
    // Arrange
    const depth = 6.5 - (6.7 - FREE_BALL.wallCushion)

    // Act
    const impulse = cushionImpulse(6.5, -2, MASS, FRAME)

    // Assert
    expect(impulse / MASS).toBeCloseTo(-depth * FREE_BALL.cushionStiffness * FRAME)
  })
})

describe('needsRescue, stalledFor and rescueLateral', () => {
  it.each([
    [{ heightAboveDeck: 0, forwardSpeed: 12, braking: false, stalledSeconds: 0 }, false],
    [{ heightAboveDeck: 1.2, forwardSpeed: 12, braking: false, stalledSeconds: 0 }, false],
    [{ heightAboveDeck: -3, forwardSpeed: 12, braking: false, stalledSeconds: 0 }, true],
    [{ heightAboveDeck: 0, forwardSpeed: 0, braking: false, stalledSeconds: 1.2 }, true],
    [{ heightAboveDeck: 0, forwardSpeed: 0, braking: true, stalledSeconds: 1.2 }, false]
  ])('for %o is %s', (check, expected) => {
    // Act
    const rescue = needsRescue(check)

    // Assert
    expect(rescue).toBe(expected)
  })

  it.each([
    [{ forwardSpeed: 0.5, braking: false }, 0.6],
    [{ forwardSpeed: 0.5, braking: true }, 0],
    [{ forwardSpeed: 12, braking: false }, 0]
  ])('counts a stall for %o as %f s after half a second', (motion, expected) => {
    // Act
    const seconds = stalledFor(motion, 0.5, 0.1)

    // Assert
    expect(seconds).toBeCloseTo(expected)
  })

  it.each([
    [0, 0],
    [3.6, 3.6],
    [6.6, 5.2],
    [-9, -5.2]
  ])('puts a ball at %f back at %f, clear of the wall cushion', (lateral, expected) => {
    // Act
    const backAt = rescueLateral(lateral)

    // Assert
    expect(backAt).toBeCloseTo(expected)
  })
})
