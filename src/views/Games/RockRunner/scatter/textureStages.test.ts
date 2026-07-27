import { describe, it, expect } from 'vitest'
import { stageIndexAt, texturesAt, stageColorAt } from './textureStages'
import { SCATTER_AREAS } from './illustrations'
import { FOG_STAGE_COLORS, SCATTER_STAGE_LENGTH, TERRAIN_STAGE_TINTS } from '../config'
import type { ScatterAreaDefinition, ScatterTexture } from '../types'

const area = (name: string): ScatterAreaDefinition =>
  SCATTER_AREAS.find((entry) => entry.name === name) as ScatterAreaDefinition

const texture = (name: string): ScatterTexture => ({
  id: name,
  name,
  filename: name,
  url: name
})

describe('stageIndexAt', () => {
  it.each([
    [0, 0],
    [SCATTER_STAGE_LENGTH - 1, 0],
    [SCATTER_STAGE_LENGTH, 1],
    [SCATTER_STAGE_LENGTH * 2, 2]
  ])('distance %i falls in stage %i', (distance, expected) => {
    expect(stageIndexAt(distance, 3)).toBe(expected)
  })

  // The sequence loops, so a long run keeps changing character rather than
  // settling into one look for the rest of it.
  it('wraps back to the first stage past the last', () => {
    expect(stageIndexAt(SCATTER_STAGE_LENGTH * 3, 3)).toBe(0)
    expect(stageIndexAt(SCATTER_STAGE_LENGTH * 4, 3)).toBe(1)
  })

  it('keeps looping however far the run goes', () => {
    expect(stageIndexAt(SCATTER_STAGE_LENGTH * 50, 3)).toBe(50 % 3)
  })

  it('treats the track behind the origin as the first stage', () => {
    expect(stageIndexAt(-SCATTER_STAGE_LENGTH, 3)).toBe(0)
  })

  it('returns the first stage when an area defines none', () => {
    expect(stageIndexAt(SCATTER_STAGE_LENGTH * 4, 0)).toBe(0)
  })
})

describe('texturesAt', () => {
  it('keeps an unstaged area on its live list, so the panel can still add to it', () => {
    const added = [texture('extra.webp')]

    expect(texturesAt(area('rock'), SCATTER_STAGE_LENGTH * 3, added)).toBe(added)
  })

  it('walks a staged area through its stages', () => {
    const tree = area('tree')
    const names = [0, 1, 2].map(
      (stage) => texturesAt(tree, stage * SCATTER_STAGE_LENGTH, [])[0].filename
    )

    expect(names).toEqual(['Tree1-1.webp', 'Tree1-6.webp', 'Tree1-8.webp'])
  })

  it('walks the second tree through its own stages', () => {
    const names = [0, 1, 2].map(
      (stage) => texturesAt(area('tree-2'), stage * SCATTER_STAGE_LENGTH, [])[0].filename
    )

    expect(names).toEqual(['Tree1-2.webp', 'Tree1-4.webp', 'Tree1-7.webp'])
  })

  // Two illustrations across three stages, so one is held for a stage. The
  // repeat is the second, leaving the wrap back to the first a real change.
  it('repeats the bush second illustration to fill its third stage', () => {
    const bush = area('bush')
    const at = (stage: number) => texturesAt(bush, stage * SCATTER_STAGE_LENGTH, [])[0].filename

    expect(at(0)).toBe('Bush1-2.webp')
    expect(at(1)).toBe('Bush1-1.webp')
    expect(at(2)).toBe('Bush1-1.webp')
    expect(at(3)).toBe('Bush1-2.webp')
  })

  // Areas are staged into each chunk as it is built, so any area with a
  // different count would reach its milestones out of step with the rest.
  it('gives every staged area the same number of stages, matching the fog', () => {
    const counts = SCATTER_AREAS.filter((entry) => entry.textureStages).map(
      (entry) => entry.textureStages!.length
    )

    expect(new Set(counts).size).toBe(1)
    expect(counts[0]).toBe(FOG_STAGE_COLORS.length)
  })

  it('never returns an empty set for a staged area', () => {
    SCATTER_AREAS.filter((entry) => entry.textureStages).forEach((entry) => {
      ;[0, 1, 2, 10].forEach((stage) => {
        expect(texturesAt(entry, stage * SCATTER_STAGE_LENGTH, []).length).toBeGreaterThan(0)
      })
    })
  })
})

describe('stageColorAt', () => {
  const GREEN = 0x638638
  const TAN = 0xb08a55
  const RED = 0xb0534e
  const palette = [GREEN, TAN, RED]

  // Each colour has to land exactly on its own milestone, or a stage boundary
  // reads as an accident rather than a change of scene.
  it.each([
    [0, GREEN],
    [SCATTER_STAGE_LENGTH, TAN],
    [SCATTER_STAGE_LENGTH * 2, RED]
  ])('is exactly the stage colour at %i', (distance, expected) => {
    expect(stageColorAt(distance, palette)).toBe(expected)
  })

  it('blends between stages rather than stepping', () => {
    const middle = stageColorAt(SCATTER_STAGE_LENGTH / 2, palette)

    expect(middle).not.toBe(GREEN)
    expect(middle).not.toBe(TAN)
  })

  it('moves steadily from one stage colour toward the next', () => {
    const red = (distance: number) => (stageColorAt(distance, palette) >> 16) & 0xff

    // Green to tan raises the red channel from 0x63 to 0xb0 throughout.
    expect(red(SCATTER_STAGE_LENGTH * 0.25)).toBeGreaterThan(red(0))
    expect(red(SCATTER_STAGE_LENGTH * 0.75)).toBeGreaterThan(red(SCATTER_STAGE_LENGTH * 0.25))
  })

  it('wraps the palette back to the first colour past the last', () => {
    expect(stageColorAt(SCATTER_STAGE_LENGTH * 3, palette)).toBe(GREEN)
    expect(stageColorAt(SCATTER_STAGE_LENGTH * 4, palette)).toBe(TAN)
  })

  it('blends from the last colour back toward the first', () => {
    const blended = stageColorAt(SCATTER_STAGE_LENGTH * 2.5, palette)

    expect(blended).not.toBe(RED)
    expect(blended).not.toBe(GREEN)
  })

  it('treats the track behind the origin as the first colour', () => {
    expect(stageColorAt(-100, palette)).toBe(GREEN)
  })

  it('survives an empty palette', () => {
    expect(stageColorAt(500, [])).toBe(0)
  })

  it('holds a single-colour palette', () => {
    expect(stageColorAt(SCATTER_STAGE_LENGTH * 3, [TAN])).toBe(TAN)
    expect(stageColorAt(SCATTER_STAGE_LENGTH * 3.5, [TAN])).toBe(TAN)
  })
})

describe('terrain stage tints', () => {
  // The terrain tint multiplies a ground texture, so the fog colours used as
  // they are would darken the countryside to mud.
  it('are lighter than the fog colours they follow', () => {
    const brightness = (color: number) =>
      ((color >> 16) & 0xff) + ((color >> 8) & 0xff) + (color & 0xff)

    TERRAIN_STAGE_TINTS.forEach((tint, stage) =>
      expect(brightness(tint)).toBeGreaterThan(brightness(FOG_STAGE_COLORS[stage]))
    )
  })

  it('define a tint for every fog stage', () => {
    expect(TERRAIN_STAGE_TINTS).toHaveLength(FOG_STAGE_COLORS.length)
  })

  it('walk the stages alongside the fog', () => {
    const at = (stage: number) => stageColorAt(stage * SCATTER_STAGE_LENGTH, TERRAIN_STAGE_TINTS)

    expect(at(0)).toBe(TERRAIN_STAGE_TINTS[0])
    expect(at(1)).toBe(TERRAIN_STAGE_TINTS[1])
    expect(at(2)).toBe(TERRAIN_STAGE_TINTS[2])
    expect(at(3)).toBe(TERRAIN_STAGE_TINTS[0])
  })
})
