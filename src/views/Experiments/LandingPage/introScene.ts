import * as THREE from 'three'
import {
  SVG_BODY_BOUNDS,
  SVG_EYES,
  EYE_FRONT_OFFSET,
  EYE_SEGMENTS,
  EYELID_MIN_SCALE,
  EYELID_OVERLAP,
  EYE_PROBE_STEPS,
  ROOM_WALL_COLOR,
  ROOM_FLOOR_COLOR,
  ROOM_SIZE,
  ROOM_ROUGHNESS,
  SPOT_INTENSITY,
  SHADOW_RADIUS,
  RIM_LIGHT_COLOR,
  RIM_LIGHT_POWER,
  SPOT_SIDE,
  SPOT_HEIGHT,
  SPOT_FORWARD,
  SPOT_ANGLE,
  SPOT_PENUMBRA,
  SPOT_COLOR
} from './config'
import type { LogoIntroPose, Room, LogoRest } from './types'

const createRoomSurface = (color: number): [THREE.Mesh, THREE.MeshStandardMaterial] => {
  const material = new THREE.MeshStandardMaterial({ color, roughness: ROOM_ROUGHNESS })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE), material)
  mesh.receiveShadow = true
  return [mesh, material]
}

/**
 * Builds the room: a back wall and a floor meeting along one seam, lit by the same lights as
 * the logo so it reads as sitting in the corner rather than in front of a backdrop.
 * @param scene The scene to add them to.
 * @param floorY Height of the floor.
 * @param wallZ Depth of the back wall.
 * @returns The room meshes and their materials.
 */
export const createRoom = (scene: THREE.Scene, floorY: number, wallZ: number): Room => {
  const [wall, wallMaterial] = createRoomSurface(ROOM_WALL_COLOR)
  wall.name = 'room-wall'
  wall.position.set(0, floorY + ROOM_SIZE / 2, wallZ)

  const [floor, floorMaterial] = createRoomSurface(ROOM_FLOOR_COLOR)
  floor.name = 'room-floor'
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, floorY, wallZ + ROOM_SIZE / 2)

  scene.add(wall, floor)
  return { meshes: [wall, floor], materials: [wallMaterial, floorMaterial] }
}

/**
 * Adds a soft spotlight aimed at the corner where the logo sleeps.
 * @param scene The scene to add it to.
 * @param target Where the logo's feet rest.
 * @returns The spotlight.
 */
export const createCornerSpot = (scene: THREE.Scene, target: THREE.Vector3): THREE.SpotLight => {
  const spot = new THREE.SpotLight(SPOT_COLOR, SPOT_INTENSITY, 0, SPOT_ANGLE, SPOT_PENUMBRA)
  spot.name = 'corner-spot'
  spot.castShadow = true
  spot.shadow.radius = SHADOW_RADIUS
  scene.add(spot, spot.target)
  aimSpot(spot, target)
  return spot
}

/**
 * Moves the spotlight so it lights a point from above, in front and a little to the side.
 * @param spot The spotlight from createCornerSpot.
 * @param target The point to light.
 */
export const aimSpot = (spot: THREE.SpotLight, target: THREE.Vector3): void => {
  spot.position.set(target.x + SPOT_SIDE, target.y + SPOT_HEIGHT, target.z + SPOT_FORWARD)
  spot.target.position.copy(target)
}

const svgToWorld = (box: THREE.Box3, svgX: number, svgY: number): THREE.Vector3 => {
  const { minX, maxX, minY, maxY } = SVG_BODY_BOUNDS
  return new THREE.Vector3(
    THREE.MathUtils.lerp(box.min.x, box.max.x, (svgX - minX) / (maxX - minX)),
    THREE.MathUtils.lerp(box.max.y, box.min.y, (svgY - minY) / (maxY - minY)),
    box.max.z + EYE_FRONT_OFFSET
  )
}

const holeProbe = new THREE.Raycaster()
const probeDirection = new THREE.Vector3(0, 0, -1)
const probeOrigin = new THREE.Vector3()

// The SVG artwork and the exported model do not line up exactly, so the hole is measured on the
// mesh itself: rays shot straight through the face around the expected spot, and the ones that
// pass through without touching the front surface are the hole.
const measureEyeHole = (
  model: THREE.Object3D,
  box: THREE.Box3,
  expected: THREE.Vector3,
  searchRadius: number
): { center: THREE.Vector3; radius: number } => {
  const cell = (2 * searchRadius) / EYE_PROBE_STEPS
  const frontLimit = box.max.z - (box.max.z - box.min.z) / 2
  const through = Array.from({ length: (EYE_PROBE_STEPS + 1) ** 2 }, (_, index) => {
    const x = expected.x - searchRadius + (index % (EYE_PROBE_STEPS + 1)) * cell
    const y = expected.y - searchRadius + Math.floor(index / (EYE_PROBE_STEPS + 1)) * cell
    holeProbe.set(probeOrigin.set(x, y, box.max.z + 1), probeDirection)
    const [hit] = holeProbe.intersectObject(model, true)
    return !hit || hit.point.z < frontLimit ? new THREE.Vector2(x, y) : null
  }).filter((point): point is THREE.Vector2 => point !== null)
  if (through.length === 0) return { center: expected, radius: searchRadius / 2 }
  const sum = through.reduce((total, point) => total.add(point), new THREE.Vector2())
  return {
    center: new THREE.Vector3(sum.x / through.length, sum.y / through.length, expected.z),
    radius: Math.sqrt((through.length * cell * cell) / Math.PI)
  }
}

/**
 * Covers the eye holes of the logo with lids in its own material, hinged at their top edge so
 * opening them reveals the holes.
 * @param model The logo, already scaled and placed at rest.
 * @param material The logo's material, so a closed lid reads as part of the face.
 * @returns The lid meshes, parented to the logo so they follow every turn and jump.
 */
export const createLogoEyelids = (
  model: THREE.Object3D,
  material: THREE.Material
): THREE.Mesh[] => {
  model.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(model)
  const unitsPerSvg = (box.max.x - box.min.x) / (SVG_BODY_BOUNDS.maxX - SVG_BODY_BOUNDS.minX)
  return SVG_EYES.map(({ x, y, radius }, index) => {
    const hole = measureEyeHole(model, box, svgToWorld(box, x, y), radius * unitsPerSvg * 2)
    const lidRadius = hole.radius * EYELID_OVERLAP
    const geometry = new THREE.CircleGeometry(lidRadius, EYE_SEGMENTS).translate(0, -lidRadius, 0)
    const eyelid = new THREE.Mesh(geometry, material)
    eyelid.name = `logo-eyelid-${index}`
    eyelid.position.copy(hole.center).setY(hole.center.y + lidRadius)
    model.attach(eyelid)
    return eyelid
  })
}

/**
 * Raises or lowers the lids.
 * @param eyelids The meshes from createLogoEyelids.
 * @param openness 0 closed, 1 fully open.
 */
export const setEyelidsOpen = (eyelids: THREE.Mesh[], openness: number): void => {
  eyelids.forEach((eyelid) => eyelid.scale.setY(Math.max(EYELID_MIN_SCALE, 1 - openness)))
}

const tiltAxis = new THREE.Vector3(0, 0, 1)
const yawAxis = new THREE.Vector3(0, 1, 0)
const scratchYaw = new THREE.Quaternion()
const scratchOffset = new THREE.Vector3()

/**
 * Places the logo in a pose, turning and leaning it around the centre of its base so its feet
 * stay planted.
 * @param model The logo.
 * @param pose The pose from the intro timeline.
 * @param rest The offset from its feet to its origin at rest.
 */
export const applyLogoPose = (model: THREE.Object3D, pose: LogoIntroPose, rest: LogoRest) => {
  scratchYaw.setFromAxisAngle(yawAxis, pose.yaw)
  model.quaternion.setFromAxisAngle(tiltAxis, pose.tilt).multiply(scratchYaw)
  scratchOffset.copy(rest.feetOffset).applyQuaternion(model.quaternion)
  model.position.set(...pose.feet).add(scratchOffset)
}

/**
 * Gives a material a rim light of its own: faces that turn away from the camera glow faintly in a
 * cool colour, outlining the object. A real light from behind would also light the floor and the
 * wall; this touches only the objects that use the material.
 * @param material The logo and letters' material.
 * @returns The rim's strength, to dim and raise with the room's lights.
 */
export const addRimLight = (material: THREE.MeshStandardMaterial): THREE.IUniform<number> => {
  const strength: THREE.IUniform<number> = { value: 0 }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimStrength = strength
    shader.uniforms.rimColor = { value: new THREE.Color(RIM_LIGHT_COLOR) }
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float rimStrength;\nuniform vec3 rimColor;\nvoid main() {')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // In view space the camera looks along z, so a normal's z says how squarely a face meets it.
        float sideOn = 1.0 - abs(normal.z);
        totalEmissiveRadiance += rimColor * pow(sideOn, ${RIM_LIGHT_POWER.toFixed(1)}) * rimStrength;`
      )
  }
  return strength
}
