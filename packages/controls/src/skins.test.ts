import { describe, it, expect } from 'vitest'
import { CONTROL_SKINS, getDefaultSkinId } from './skins'

describe('CONTROL_SKINS', () => {
  it('provides a default plus at least one alternate skin', () => {
    expect(CONTROL_SKINS.length).toBeGreaterThanOrEqual(2)
  })

  it('marks exactly one skin as default', () => {
    expect(CONTROL_SKINS.filter((skin) => skin.isDefault)).toHaveLength(1)
  })

  it('has unique skin ids', () => {
    const ids = CONTROL_SKINS.map((skin) => skin.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('getDefaultSkinId', () => {
  it('returns the id of the skin flagged as default', () => {
    const defaultSkin = CONTROL_SKINS.find((skin) => skin.isDefault)
    expect(getDefaultSkinId()).toBe(defaultSkin!.id)
  })
})
