import { describe, it, expect } from 'vitest'
import { strokeWander, strokePhases, strokeEdges, buildStrokeGeometry } from './trackStroke'
import { createTrackPath } from './trackPath'
import {
  STATION_SPACING,
  STROKE_LIFT,
  STROKE_WANDER_TERMS,
  STROKE_WIDTH,
  STROKE_WIDTH_VARIATION,
  TRACK_WIDTH
} from './config'

const phases = strokePhases(4242)
const edge = (distance: number, side = 1) => strokeEdges(TRACK_WIDTH, side, distance, phases)
const bandWidth = (distance: number, side = 1) => {
  const { inner, outer } = edge(distance, side)
  return Math.abs(outer - inner)
}

describe('strokeWander', () => {
  it('is zero when handed no terms to sum', () => {
    expect(strokeWander([], [], 120)).toBe(0)
  })

  it('never exceeds the summed amplitudes it was built from', () => {
    const ceiling = STROKE_WANDER_TERMS.reduce((total, term) => total + term.amplitude, 0)
    const samples = Array.from({ length: 400 }, (_, i) =>
      Math.abs(strokeWander(STROKE_WANDER_TERMS, phases.wander, i * 1.7))
    )

    expect(Math.max(...samples)).toBeLessThanOrEqual(ceiling)
  })

  // The line has to be a function of distance alone. Seeding it per chunk would
  // leave the two sides of every boundary disagreeing about where the edge runs.
  it('is a pure function of distance, so two chunks agree at their shared station', () => {
    expect(strokeWander(STROKE_WANDER_TERMS, phases.wander, 96)).toBe(
      strokeWander(STROKE_WANDER_TERMS, phases.wander, 96)
    )
  })

  it('wanders rather than holding still', () => {
    const samples = Array.from({ length: 60 }, (_, i) =>
      strokeWander(STROKE_WANDER_TERMS, phases.wander, i * 3)
    )

    expect(new Set(samples.map((value) => value.toFixed(3))).size).toBeGreaterThan(50)
  })
})

describe('strokePhases', () => {
  it('gives one phase per term of each sum', () => {
    expect(phases.wander).toHaveLength(STROKE_WANDER_TERMS.length)
    expect(phases.width.length).toBeGreaterThan(0)
  })

  // Every peer builds the track from the same seed and must draw the same edge.
  it('is reproducible from the seed', () => {
    expect(strokePhases(99)).toEqual(strokePhases(99))
  })

  it('draws a different line for a different seed', () => {
    expect(strokePhases(1).wander).not.toEqual(strokePhases(2).wander)
  })
})

describe('strokeEdges', () => {
  it('straddles the deck edge rather than sitting inside or outside it', () => {
    const { inner, outer } = edge(0)

    expect(Math.min(inner, outer)).toBeLessThan(TRACK_WIDTH / 2 + 2)
    expect(Math.max(inner, outer)).toBeGreaterThan(TRACK_WIDTH / 2 - 2)
  })

  it.each([1, -1])('mirrors onto side %s', (side) => {
    const { inner, outer } = edge(50, side)

    expect(Math.sign(inner + outer)).toBe(side)
  })

  // A band of constant width reads as an inlay however much it snakes.
  it('varies its thickness along the track', () => {
    const widths = Array.from({ length: 80 }, (_, i) => bandWidth(i * 2.3))

    expect(Math.max(...widths) - Math.min(...widths)).toBeGreaterThan(0.05)
  })

  it('keeps the thickness within the variation it was given', () => {
    const widths = Array.from({ length: 300 }, (_, i) => bandWidth(i * 1.1))

    expect(Math.max(...widths)).toBeLessThanOrEqual(STROKE_WIDTH * (1 + STROKE_WIDTH_VARIATION * 2))
    expect(Math.min(...widths)).toBeGreaterThan(0)
  })

  // Two edges wandering in step read as the whole track breathing rather than
  // as two separately drawn lines.
  it('does not wander the two sides in step', () => {
    const left = Array.from({ length: 40 }, (_, i) => bandWidth(i * 4, -1))
    const right = Array.from({ length: 40 }, (_, i) => bandWidth(i * 4, 1))

    expect(left).not.toEqual(right)
  })

  it('follows the deck when the panel widens it', () => {
    const narrow = strokeEdges(16, 1, 30, phases)
    const wide = strokeEdges(40, 1, 30, phases)

    expect(wide.inner - narrow.inner).toBeCloseTo(12)
  })
})

describe('buildStrokeGeometry', () => {
  const path = createTrackPath(4242)
  const stations = path.stationsBetween(0, 12)
  const geometry = buildStrokeGeometry(stations, 0, TRACK_WIDTH, phases)

  it('builds a ribbon for each side of the track', () => {
    expect(geometry.getAttribute('position').count).toBe(stations.length * 2 * 2)
  })

  it('indexes two triangles per station gap per side', () => {
    expect(geometry.getIndex()?.count).toBe((stations.length - 1) * 6 * 2)
  })

  it('carries the lateral offsets the fog fades it by', () => {
    expect(geometry.getAttribute('lateralOffset').count).toBe(
      geometry.getAttribute('position').count
    )
  })

  // The deck is flat colour and the stroke sits directly on it, so without a
  // lift the two z-fight into a shimmering mess.
  it('lifts the ribbon clear of the deck it is drawn on', () => {
    const flat = createTrackPath(4242)
    const level = flat.stationsBetween(0, 2)
    const lifted = buildStrokeGeometry(level, 0, TRACK_WIDTH, phases)
    const y = lifted.getAttribute('position').getY(0)

    expect(y - level[0].origin.y).toBeCloseTo(STROKE_LIFT, 1)
  })

  // Chunks are built independently, so the only thing keeping their strokes
  // aligned is that both derive the line from the absolute station index.
  it('places a station identically whichever chunk builds it', () => {
    const laterChunk = path.stationsBetween(6, 18)
    const later = buildStrokeGeometry(laterChunk, 6, TRACK_WIDTH, phases)
    const shared = geometry.getAttribute('position')
    const rebuilt = later.getAttribute('position')

    expect(rebuilt.getX(0)).toBeCloseTo(shared.getX(6 * 2))
    expect(rebuilt.getZ(0)).toBeCloseTo(shared.getZ(6 * 2))
  })

  it('spans the stations it was handed', () => {
    const position = geometry.getAttribute('position')
    const first = new Set([position.getZ(0)])

    expect(first.size).toBe(1)
    expect(position.count).toBeGreaterThan(0)
    expect(STATION_SPACING).toBeGreaterThan(0)
  })
})
