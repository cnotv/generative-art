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

const stateWith = (rock: unknown, released: boolean): RunState =>
  ({ rock, released }) as unknown as RunState

describe('createStartGate', () => {
  it('switches gravity off while the countdown holds the rock', () => {
    const { scales, rock } = stubRock()

    createStartGate(stateWith(rock, true)).hold()

    expect(scales).toEqual([0])
  })

  // The rock falls several times harder than the world it sits in. Releasing it
  // to the world's own scale looked like a reset but silently ran the whole
  // race at a fraction of the intended gravity, which read as floatiness.
  it('releases the rock at its own gravity rather than the world default', () => {
    const { scales, rock } = stubRock()

    createStartGate(stateWith(rock, false)).release()

    expect(scales).toEqual([ROCK_GRAVITY_SCALE])
    expect(scales).not.toContain(1)
  })

  it('releases only once so a held rock is not re-released mid-run', () => {
    const { scales, rock } = stubRock()
    const gate = createStartGate(stateWith(rock, true))

    gate.release()

    expect(scales).toEqual([])
  })
})
