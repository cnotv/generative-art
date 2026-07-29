import { describe, it, expect } from 'vitest'
import {
  ROCK_SURFACES,
  DEFAULT_ROCK_SURFACE,
  rockSurfaceById,
  rockSurfaceOptions
} from './rockSurfaces'
import { ROCK_TINT } from '../config'

describe('ROCK_SURFACES', () => {
  it('offers the scanned stone and the three painted tiles', () => {
    expect(ROCK_SURFACES).toHaveLength(4)
  })

  it.each(ROCK_SURFACES)('gives $id a label and a texture', (surface) => {
    expect(surface.label).toBeTruthy()
    expect(surface.colorUrl).toBeTruthy()
  })

  it('gives every surface a distinct id, which is what the lobby sends', () => {
    expect(new Set(ROCK_SURFACES.map((surface) => surface.id)).size).toBe(ROCK_SURFACES.length)
  })

  it('draws each from its own texture', () => {
    expect(new Set(ROCK_SURFACES.map((surface) => surface.colorUrl)).size).toBe(
      ROCK_SURFACES.length
    )
  })

  // The relief maps were scanned from the same stone as the first surface's
  // colour. Lighting a painted tile with them embosses one rock's cracks onto
  // another's picture, so only the surface they belong to claims them.
  it('claims relief only for the surface the scanned maps describe', () => {
    const withRelief = ROCK_SURFACES.filter((surface) => surface.relief)

    expect(withRelief).toHaveLength(1)
    expect(withRelief[0].id).toBe('stone')
  })

  // The scanned stone is very dark and is lifted by a warm multiplier. The
  // painted tiles arrive at the colour their artist chose, and a multiplier
  // can only ever subtract from it.
  it('tints the scanned stone and leaves the painted ones alone', () => {
    expect(rockSurfaceById('stone').tint).toBe(ROCK_TINT)
    ROCK_SURFACES.filter((surface) => !surface.relief).forEach((surface) => {
      expect(surface.tint).toBe(0xffffff)
    })
  })
})

describe('rockSurfaceById', () => {
  it.each(ROCK_SURFACES.map((surface) => surface.id))('finds %s', (id) => {
    expect(rockSurfaceById(id).id).toBe(id)
  })

  // An id can outlive the surface it named, through a saved lobby config or a
  // peer on an older build, and a rock with no material is a hole in the screen.
  it.each(['', 'granite', 'undefined'])('falls back to the default for %s', (id) => {
    expect(rockSurfaceById(id).id).toBe(DEFAULT_ROCK_SURFACE)
  })
})

describe('rockSurfaceOptions', () => {
  it('names a default that exists in the catalogue', () => {
    expect(ROCK_SURFACES.map((surface) => surface.id)).toContain(DEFAULT_ROCK_SURFACE)
  })

  it('offers one option per surface, in catalogue order', () => {
    expect(rockSurfaceOptions().map((option) => option.value)).toEqual(
      ROCK_SURFACES.map((surface) => surface.id)
    )
  })

  it('labels them for a player rather than by id', () => {
    expect(rockSurfaceOptions().every((option) => option.label !== option.value)).toBe(true)
  })
})
