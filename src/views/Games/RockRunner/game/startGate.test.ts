import { describe, it, expect } from 'vitest'
import { createStartGate } from './useRockRun'
import { ROCK_GRAVITY_SCALE } from '../config'
import type { RunState } from '../types'

const stubRock = () => {
  const scales: number[] = []
  const body = {
    setGravityScale: (scale: number) => scales.push(scale),
    setLinvel: () => {},
    setAngvel: () => {}
  }
  return { scales, rock: { userData: { body } } }
}

const stateWith = (rock: unknown, released: boolean, gravityScale?: number): RunState =>
  ({
    rock,
    released,
    rockConfig: gravityScale === undefined ? null : { gravityScale }
  }) as unknown as RunState

describe('createStartGate', () => {
  it('switches gravity off while the countdown holds the rock', () => {
    const { scales, rock } = stubRock()

    createStartGate(stateWith(rock, true)).hold()

    expect(scales).toEqual([0])
  })

  // Releasing to the world's own scale looked like a reset and was not: it
  // threw the rock's configured gravity away for the entire race, which read
  // as floatiness however the constant was set.
  it('releases the rock at its configured gravity', () => {
    const { scales, rock } = stubRock()

    createStartGate(stateWith(rock, false)).release()

    expect(scales).toEqual([ROCK_GRAVITY_SCALE])
  })

  it.each([0.5, 4, 12])('releases at %s when the panel has changed it', (gravityScale) => {
    const { scales, rock } = stubRock()

    createStartGate(stateWith(rock, false, gravityScale)).release()

    expect(scales).toEqual([gravityScale])
  })

  it('releases only once so a held rock is not re-released mid-run', () => {
    const { scales, rock } = stubRock()
    const gate = createStartGate(stateWith(rock, true))

    gate.release()

    expect(scales).toEqual([])
  })
})
