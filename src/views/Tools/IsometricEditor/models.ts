import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { getBall, getCube, getCylinder } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/threejs'
import type { CityModel, ModelPart } from './types'

const scaleToWorld = (cells: CoordinateTuple, cellSize: number): CoordinateTuple => [
  cells[0] * cellSize,
  cells[1] * cellSize,
  cells[2] * cellSize
]

/**
 * Build one primitive of a model, positioned as though its cell sat on the origin
 * @param scene The Three.js scene
 * @param world The Rapier physics world
 * @param part The primitive to build
 * @param cellSize The width of one grid cell in world units
 * @returns The mesh, already added to the scene
 */
const buildPart = (
  scene: THREE.Scene,
  world: RAPIER.World,
  part: ModelPart,
  cellSize: number
): THREE.Mesh => {
  const size = scaleToWorld(part.size, cellSize)
  const [offsetX, offsetY, offsetZ] = scaleToWorld(part.offset, cellSize)
  const options = { color: part.color, type: 'fixed' as const }

  // A ball is positioned from its centre while the other two sit on their underside, so it is
  // lifted by its radius to leave every offset meaning the same thing.
  if (part.shape === 'ball') {
    const radius = size[0] / 2
    return getBall(scene, world, {
      ...options,
      size: radius,
      position: [offsetX, offsetY + radius, offsetZ]
    })
  }

  const getShape = part.shape === 'cube' ? getCube : getCylinder
  return getShape(scene, world, { ...options, size, position: [offsetX, offsetY, offsetZ] })
}

/**
 * Assemble a city model into a group, so a placement moves, hides and disposes as one thing
 * @param scene The Three.js scene
 * @param world The Rapier physics world
 * @param model The catalogue entry to build
 * @param cellSize The width of one grid cell in world units
 * @param name The scene name for the placement
 * @returns The assembled group, added to the scene at the origin
 */
export const buildCityModel = (
  scene: THREE.Scene,
  world: RAPIER.World,
  model: CityModel,
  cellSize: number,
  name: string
): THREE.Group => {
  const group = Object.assign(new THREE.Group(), { name })
  // Each getter adds its mesh to the scene, and adding it to the group moves it across.
  model.parts.forEach((part) => group.add(buildPart(scene, world, part, cellSize)))
  scene.add(group)
  return group
}
