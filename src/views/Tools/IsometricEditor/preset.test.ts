import { describe, it, expect } from 'vitest'
import { CITY_MODELS, CITY_PRESET, GROUND_SIZE } from './config'
import { getGridDivisions } from './grid'

const modelValues = new Set(CITY_MODELS.map((model) => model.value))
const cells = CITY_PRESET.pieces.flatMap((piece) => piece.cells)
const halfBoard = getGridDivisions(GROUND_SIZE, CITY_PRESET.cellSize) / 2

describe('city preset', () => {
  it('places something', () => {
    expect(cells.length).toBeGreaterThan(0)
  })

  it.each(CITY_PRESET.pieces.map((piece) => piece.model))(
    'names "%s", which the palette can build',
    (model) => {
      expect(modelValues.has(model)).toBe(true)
    }
  )

  // One cell claimed by two different components means the later piece silently replaces the
  // earlier one, so the layout on screen is not the layout that was written. A cell repeated
  // within one piece is fine: that is what a crossroads is, two runs of road meeting.
  it('never gives one cell to two different components', () => {
    const owners = new Map<string, string>()
    const contested = CITY_PRESET.pieces.flatMap((piece) =>
      piece.cells
        .map((cell) => cell.join(','))
        .filter((key) => {
          const owner = owners.get(key)
          owners.set(key, piece.model)
          return owner !== undefined && owner !== piece.model
        })
    )
    expect(contested).toEqual([])
  })

  it('keeps every cell on the board it is drawn for', () => {
    const offBoard = cells.filter(([cellX, cellZ]) =>
      [cellX, cellZ].some((index) => index < -halfBoard || index >= halfBoard)
    )
    expect(offBoard).toEqual([])
  })

  it('loads at a cell size the grid control offers', () => {
    expect(Number.isInteger(CITY_PRESET.cellSize)).toBe(true)
    expect(CITY_PRESET.cellSize).toBeGreaterThan(0)
  })
})
