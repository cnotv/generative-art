import * as THREE from 'three'
import type { SweepStation, CrossSection } from '@/types/sweptGeometry'

/**
 * Places every cross-section point at every station, in world space.
 * Each cross-section edge gets its own vertex pair per station: profile corners
 * stay hard while the sweep direction shades smoothly.
 *
 * @param stations - Frames the cross-section is swept through
 * @param crossSection - Closed outline swept along the stations
 * @returns Flat x, y, z position triples ready for a BufferAttribute
 */
export const sweepPositions = (stations: SweepStation[], crossSection: CrossSection): number[] =>
  stations.flatMap((station) =>
    crossSection.flatMap((current, pointIndex) => {
      const nextPoint = crossSection[(pointIndex + 1) % crossSection.length]
      return [current, nextPoint].flatMap(([x, y]) => {
        const point = new THREE.Vector3(x, y, 0)
          .applyQuaternion(station.orientation)
          .add(station.origin)
        return [point.x, point.y, point.z]
      })
    })
  )

/**
 * Indexes the swept side quads plus the two end caps.
 * Winding matters: Rapier's FIX_INTERNAL_EDGES corrects contact normals using
 * the triangles' face normals, so every face must point outward (deck up).
 *
 * @param stationCount - How many stations the sweep has
 * @param crossSection - Closed outline swept along the stations
 * @returns Triangle indices into the array produced by sweepPositions
 */
export const sweepIndices = (stationCount: number, crossSection: CrossSection): number[] => {
  const edgeCount = crossSection.length
  const perStation = edgeCount * 2
  const sideQuads = Array.from({ length: stationCount - 1 }, (_, station) =>
    Array.from({ length: edgeCount }, (_, edge) => {
      const a = station * perStation + edge * 2
      const b = a + 1
      const c = (station + 1) * perStation + edge * 2
      const d = c + 1
      return [a, b, c, b, d, c]
    }).flat()
  ).flat()
  const capTriangles = THREE.ShapeUtils.triangulateShape(
    crossSection.map(([x, y]) => new THREE.Vector2(x, y)),
    []
  )
  const endBase = (stationCount - 1) * perStation
  const caps = capTriangles.flatMap(([a, b, c]) => [
    a * 2,
    b * 2,
    c * 2,
    endBase + a * 2,
    endBase + c * 2,
    endBase + b * 2
  ])
  return [...sideQuads, ...caps]
}

/**
 * Sweeps a closed cross-section through a list of stations into one solid mesh.
 *
 * @param stations - Frames the cross-section is swept through
 * @param crossSection - Closed outline swept along the stations
 * @returns An indexed BufferGeometry with computed vertex normals
 */
export const buildSweepGeometry = (
  stations: SweepStation[],
  crossSection: CrossSection
): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(sweepPositions(stations, crossSection), 3)
  )
  geometry.setIndex(sweepIndices(stations.length, crossSection))
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Flattens a geometry into a world-space triangle soup for a Rapier trimesh.
 *
 * @param geometry - Geometry to flatten, indexed or not
 * @param matrix - World transform applied to every vertex
 * @returns Flat x, y, z triples, three per triangle corner
 */
export const geometryWorldTriangles = (
  geometry: THREE.BufferGeometry,
  matrix: THREE.Matrix4
): number[] => {
  const world = geometry.clone().applyMatrix4(matrix)
  const soup = world.index ? world.toNonIndexed() : world
  const positions = [...(soup.getAttribute('position').array as Float32Array)]
  if (soup !== world) soup.dispose()
  world.dispose()
  return positions
}
