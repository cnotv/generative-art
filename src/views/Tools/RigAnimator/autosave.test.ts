import { describe, it, expect, beforeEach } from 'vitest'
import { saveRigAutosave, loadRigAutosave, clearRigAutosave, type RigAutosave } from './autosave'

const sample: RigAutosave = {
  fps: 24,
  frameMax: 90,
  keyframes: [{ frame: 0, pose: { hips: { x: 0, y: 0, z: 0, w: 1 } } }]
}

describe('rig autosave', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a saved edit', () => {
    saveRigAutosave(sample)

    expect(loadRigAutosave()).toEqual(sample)
  })

  it('round-trips keyframes that carry root positions', () => {
    const withPositions: RigAutosave = {
      ...sample,
      keyframes: [{ ...sample.keyframes[0], positions: { hips: { x: 0, y: 1, z: 2 } } }]
    }

    saveRigAutosave(withPositions)

    expect(loadRigAutosave()).toEqual(withPositions)
  })

  it('returns null when nothing has been saved', () => {
    expect(loadRigAutosave()).toBeNull()
  })

  it('returns null for a value that does not match the expected shape', () => {
    localStorage.setItem('rig-animator-autosave', JSON.stringify({ fps: 24 }))

    expect(loadRigAutosave()).toBeNull()
  })

  it('clears a saved edit', () => {
    saveRigAutosave(sample)

    clearRigAutosave()

    expect(loadRigAutosave()).toBeNull()
  })
})
