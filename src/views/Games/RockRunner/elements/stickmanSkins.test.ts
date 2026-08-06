import { describe, it, expect } from 'vitest'
import {
  STICKMAN_SKINS,
  DEFAULT_STICKMAN_SKIN,
  stickmanSkinById,
  stickmanSkinOptions
} from './stickmanSkins'

describe('STICKMAN_SKINS', () => {
  it('offers the default drawing plus the example skins', () => {
    expect(STICKMAN_SKINS).toHaveLength(3)
  })

  it.each(STICKMAN_SKINS)('gives $id a label and a texture', (skin) => {
    expect(skin.label).toBeTruthy()
    expect(skin.textureUrl).toBeTruthy()
  })

  it('gives every skin a distinct id', () => {
    expect(new Set(STICKMAN_SKINS.map((skin) => skin.id)).size).toBe(STICKMAN_SKINS.length)
  })

  it('draws each from its own texture', () => {
    expect(new Set(STICKMAN_SKINS.map((skin) => skin.textureUrl)).size).toBe(STICKMAN_SKINS.length)
  })
})

describe('stickmanSkinById', () => {
  it.each(STICKMAN_SKINS.map((skin) => skin.id))('finds %s', (id) => {
    expect(stickmanSkinById(id).id).toBe(id)
  })

  // An id can outlive the skin it named, through a saved config or a peer on
  // an older build, and a rig with no material falls back to a plain one.
  it.each(['', 'robot', 'undefined'])('falls back to the default for %s', (id) => {
    expect(stickmanSkinById(id).id).toBe(DEFAULT_STICKMAN_SKIN)
  })
})

describe('stickmanSkinOptions', () => {
  it('names a default that exists in the catalogue', () => {
    expect(STICKMAN_SKINS.map((skin) => skin.id)).toContain(DEFAULT_STICKMAN_SKIN)
  })

  it('offers one option per skin, in catalogue order', () => {
    expect(stickmanSkinOptions().map((option) => option.value)).toEqual(
      STICKMAN_SKINS.map((skin) => skin.id)
    )
  })

  it('labels them for a player rather than by id', () => {
    expect(stickmanSkinOptions().every((option) => option.label !== option.value)).toBe(true)
  })
})
