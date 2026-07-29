import * as THREE from 'three'
import { seededRandomValues } from '@webgamekit/threejs'
import type { SweepStation } from '@/types/sweptGeometry'
import type { StrokeShape, StrokeTerms } from './types'
import {
  STATION_SPACING,
  STROKE_LIFT,
  STROKE_WANDER_TERMS,
  STROKE_WIDTH,
  STROKE_WIDTH_TERMS,
  STROKE_WIDTH_VARIATION
} from './config'

const TWO_PI = Math.PI * 2
const SIDES = [-1, 1] as const

/**
 * Sums a set of sine terms at a distance, the same construction the centreline
 * itself uses.
 *
 * Sines rather than per-station noise because a drawn line wanders smoothly.
 * They also make the wander a pure function of distance along the track, so two
 * chunks meeting at a station agree on where the edge is without either knowing
 * the other exists — the alternative, seeding per chunk, leaves a visible step
 * at every boundary.
 *
 * @param terms - Amplitude and wavelength pairs
 * @param phases - One phase offset per term, drawn from the track seed
 * @param distance - Distance along the track
 * @returns The summed deviation at that distance
 */
export const strokeWander = (terms: StrokeTerms, phases: number[], distance: number): number =>
  terms.reduce(
    (total, term, index) =>
      total + term.amplitude * Math.sin((TWO_PI * distance) / term.wavelength + phases[index]),
    0
  )

/**
 * Builds the phase offsets the two wanders are drawn with.
 *
 * @param seed - The track seed, so every peer draws the same edge
 * @returns Phases for the lateral wander and for the width variation
 */
export const strokePhases = (seed: number): { wander: number[]; width: number[] } => {
  const values = seededRandomValues(
    seed,
    STROKE_WANDER_TERMS.length + STROKE_WIDTH_TERMS.length
  ).map((value) => value * TWO_PI)
  return {
    wander: values.slice(0, STROKE_WANDER_TERMS.length),
    width: values.slice(STROKE_WANDER_TERMS.length)
  }
}

/**
 * Where the stroke's two edges sit at one station, in the station's own frame.
 *
 * Both the line's position and its thickness wander. Thickness matters as much
 * as position: a band of constant width reads as a machined inlay however much
 * it snakes, because a drawn line is uneven where the hand pressed harder.
 *
 * @param deckWidth - Width of the deck the stroke edges
 * @param side - Which edge, -1 for left and 1 for right
 * @param distance - Distance along the track
 * @param phases - Phases from strokePhases
 * @returns The inner and outer lateral offsets of the band
 */
export const strokeEdges = (
  deckWidth: number,
  side: number,
  distance: number,
  phases: { wander: number[]; width: number[] },
  shape: { width: number; wander: number } = { width: STROKE_WIDTH, wander: 1 }
): StrokeShape => {
  // The two sides are offset in distance so they never wander in step, which
  // would read as the whole track breathing rather than as two drawn lines.
  const offset = side > 0 ? 0 : STROKE_WANDER_TERMS[0].wavelength / 2
  const wander = strokeWander(STROKE_WANDER_TERMS, phases.wander, distance + offset) * shape.wander
  const widthWander = strokeWander(STROKE_WIDTH_TERMS, phases.width, distance + offset)
  const width = Math.max(0, shape.width * (1 + widthWander * STROKE_WIDTH_VARIATION * shape.wander))
  const centre = side * (deckWidth / 2 + wander)
  return { inner: centre - (side * width) / 2, outer: centre + (side * width) / 2 }
}

const stationPoint = (station: SweepStation, lateral: number): THREE.Vector3 =>
  new THREE.Vector3(lateral, STROKE_LIFT, 0)
    .applyQuaternion(station.orientation)
    .add(station.origin)

/**
 * Builds both edge strokes for one stretch of track as a single ribbon mesh.
 *
 * Flat ribbons rather than swept tubes: the stroke is read from directly above
 * at a glancing angle, where a tube's roundness is invisible and costs four
 * times the triangles.
 *
 * @param stations - Stations the stretch covers
 * @param firstIndex - Absolute index of the first station, which anchors the
 *   wander to the track rather than to the chunk
 * @param deckWidth - Width of the deck being edged
 * @param phases - Phases from strokePhases
 * @returns Geometry carrying position and the lateral offsets the fog reads
 */
export const buildStrokeGeometry = (
  stations: SweepStation[],
  firstIndex: number,
  deckWidth: number,
  phases: { wander: number[]; width: number[] },
  shape: { width: number; wander: number } = { width: STROKE_WIDTH, wander: 1 }
): THREE.BufferGeometry => {
  const positions: number[] = []
  const laterals: number[] = []
  const indices: number[] = []

  SIDES.forEach((side, sideIndex) => {
    const base = sideIndex * stations.length * 2
    stations.forEach((station, offset) => {
      const distance = (firstIndex + offset) * STATION_SPACING
      const { inner, outer } = strokeEdges(deckWidth, side, distance, phases, shape)
      ;[inner, outer].forEach((lateral) => {
        const point = stationPoint(station, lateral)
        positions.push(point.x, point.y, point.z)
        laterals.push(Math.abs(lateral))
      })
    })
    Array.from({ length: stations.length - 1 }).forEach((_, offset) => {
      const a = base + offset * 2
      const [b, c, d] = [a + 1, a + 2, a + 3]
      // Wound so the ribbon faces up on both sides of the track.
      indices.push(...(side > 0 ? [a, b, c, b, d, c] : [a, c, b, b, c, d]))
    })
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('lateralOffset', new THREE.Float32BufferAttribute(laterals, 1))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
