import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { getPhysic, type CoordinateTuple, type ComplexModel } from '@webgamekit/threejs'

// Local type for blade generation config
interface GenerateConfig {
  lengthCurve: {
    baseX: number
    baseY: number
    baseZ: number
    midX: number
    midY: number
    midZ: number
    tipX: number
    tipY: number
    tipZ: number
  }
  sideCurve: {
    baseX: number
    baseY: number
    baseZ: number
    midX: number
    midY: number
    midZ: number
    tipX: number
    tipY: number
    tipZ: number
  }
}

export const getBlade = (config: GenerateConfig) => {
  // Define the control points for the length curve (curvature along the length)
  // Vector values respectively: bend sides, blade silhouette, bend front
  const lengthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(config.lengthCurve.baseX, config.lengthCurve.baseY, config.lengthCurve.baseZ), // Base
    new THREE.Vector3(config.lengthCurve.midX, config.lengthCurve.midY, config.lengthCurve.midZ), // Midpoint 1
    new THREE.Vector3(config.lengthCurve.tipX, config.lengthCurve.tipY, config.lengthCurve.tipZ) // Tip
  ])

  // Define the control points for the side curve (curvature on the sides)
  // Vector values respectively: Width blade
  const sideCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(config.sideCurve.baseX, config.sideCurve.baseY, config.sideCurve.baseZ), // Base
    new THREE.Vector3(config.sideCurve.midX, config.sideCurve.midY, config.sideCurve.midZ), // Midpoint 1
    new THREE.Vector3(config.sideCurve.tipX, config.sideCurve.tipY, config.sideCurve.tipZ) // Tip
  ])

  // Define the control points for the length curve (curvature along the length)
  const lengthPoints = lengthCurve.getPoints(10)

  // Define the control points for the side curve (curvature on the sides)
  const sidePoints = sideCurve.getPoints(10)

  // Define the vertices for the grass blade
  const vertices = lengthPoints.flatMap((lengthPoint, i) => {
    const sidePoint = sidePoints[i]
    return [
      lengthPoint.x - sidePoint.x,
      lengthPoint.y,
      lengthPoint.z,
      lengthPoint.x + sidePoint.x,
      lengthPoint.y,
      lengthPoint.z
    ]
  })

  // Define the indices for the triangular faces
  const indices = Array.from({ length: lengthPoints.length - 1 }, (_, i) => {
    const baseIndex = i * 2
    return [baseIndex, baseIndex + 1, baseIndex + 2, baseIndex + 1, baseIndex + 3, baseIndex + 2]
  }).flat()

  // Define the geometry for the grass blade
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  // Define the material for the grass blade
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x33bb33,
    side: THREE.DoubleSide
  })

  // Create the mesh for the grass blade
  const blade = new THREE.Mesh(geometry, material)

  return Object.assign(blade, { castShadow: false, receiveShadow: true })
}

/**
 * Create a rounded box geometry
 * @param {CoordinateTuple} size - The size of the box
 * @param {number} radius - The radius of the box
 * @param {number} smoothness - The smoothness of the box
 * @returns {THREE.ExtrudeGeometry} The rounded box geometry
 */
export const getRoundedBox = (size: CoordinateTuple, radius: number, smoothness: number) => {
  const [width, height, depth] = size
  const shape = new THREE.Shape()
  const eps = 0.00001
  const radius0 = radius - eps
  shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true)
  shape.absarc(eps, height - radius * 2, eps, Math.PI, Math.PI / 2, true)
  shape.absarc(width - radius * 2, height - radius * 2, eps, Math.PI / 2, 0, true)
  shape.absarc(width - radius * 2, eps, eps, 0, -Math.PI / 2, true)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - radius * 2,
    bevelEnabled: true,
    bevelSegments: smoothness * 2,
    steps: 1,
    bevelSize: radius0,
    bevelThickness: radius,
    curveSegments: smoothness
  })
  geometry.center()
  return geometry
}

const COIN_RADIUS = 0.33
const COIN_THICKNESS = 0.1
const COIN_PHYSICS_SIZE = 0.42

export const getCoinBlock = (
  scene: THREE.Scene,
  world: RAPIER.World,
  { position = [1, 1, 1] }: { position: CoordinateTuple }
): ComplexModel => {
  const color = 0xffff00
  const size: CoordinateTuple = [COIN_PHYSICS_SIZE, COIN_PHYSICS_SIZE, COIN_PHYSICS_SIZE]
  const material = new THREE.MeshPhysicalMaterial({ color })
  const geometry = new THREE.CylinderGeometry(COIN_RADIUS, COIN_RADIUS, COIN_THICKNESS, 32)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  Object.assign(mesh, { castShadow: true, receiveShadow: true })
  scene.add(mesh)
  const initialValues = {
    position,
    size,
    color,
    rotation: mesh.rotation.toArray() as CoordinateTuple
  }
  mesh.rotation.set(Math.PI / 2, mesh.rotation.y, mesh.rotation.z)

  const { rigidBody, collider } = getPhysic(world, {
    position,
    size,
    boundary: 0.8,
    type: 'kinematicPositionBased'
  })
  rigidBody.setRotation({ x: Math.PI / 2, y: 0, z: 0, w: 1 }, true)

  return Object.assign(mesh, {
    userData: {
      body: rigidBody,
      collider,
      initialValues
    }
  })
}
