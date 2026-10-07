import { describe, it, expect } from 'vitest'
import { forwardImpulse, gripImpulse } from './freeDrive'
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
