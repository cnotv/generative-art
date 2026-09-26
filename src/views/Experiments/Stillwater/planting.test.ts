import { describe, it, expect } from 'vitest'
import { plantBand } from './planting'
import type { PlantingBand } from './types'

const band: PlantingBand = {
  name: 'far-bank',
  min: [100, 0, -700],
  max: [420, 0, 700],
  count: 12,
  rootLevel: -1,
  minScale: 3,
  maxScale: 5.5,
  seed: 11
}

describe('plantBand', () => {
  it('plants the count it was asked for', () => {
    expect(plantBand(band)).toHaveLength(12)
  })

  it('keeps every copy inside the band and rooted at its level', () => {
    plantBand(band).forEach(({ position }) => {
      const [x, y, z] = position as [number, number, number]
      expect(x).toBeGreaterThanOrEqual(100)
      expect(x).toBeLessThanOrEqual(420)
      expect(z).toBeGreaterThanOrEqual(-700)
      expect(z).toBeLessThanOrEqual(700)
      expect(y).toBe(-1)
    })
  })

  it('keeps every height within the band and varies the girth around it', () => {
    plantBand(band).forEach(({ scale }) => {
      const [girth, height, depth] = scale as [number, number, number]
      expect(height).toBeGreaterThanOrEqual(3)
      expect(height).toBeLessThanOrEqual(5.5)
      expect(girth).toBe(depth)
      expect(girth).toBeGreaterThan(height * 0.7)
      expect(girth).toBeLessThan(height * 1.3)
    })
  })

  it('turns the copies to different headings rather than lining them all up', () => {
    const headings = plantBand(band).map(({ rotation }) => (rotation as number[])[1])
    expect(new Set(headings).size).toBe(headings.length)
    headings.forEach((heading) => {
      expect(heading).toBeGreaterThanOrEqual(0)
      expect(heading).toBeLessThan(Math.PI * 2)
    })
  })

  it('gives the same band the same planting on every load', () => {
    expect(plantBand(band)).toEqual(plantBand(band))
  })

  it('gives a different seed a different planting', () => {
    expect(plantBand(band)).not.toEqual(plantBand({ ...band, seed: 12 }))
  })
})
