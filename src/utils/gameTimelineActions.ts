import type { Ref } from 'vue'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { cameraFollowPlayer } from '@webgamekit/threejs'
import type { ComplexModel } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/animation'

export type TimelineAction = {
  name: string
  category: string
  start: number
  action: () => void
}

/**
 * Creates a timeline action that makes the camera smoothly follow a mesh.
 * Skips when orbit controls are enabled.
 *
 * @param camera - The Three.js camera
 * @param getMesh - Getter returning the mesh to follow (or null to skip)
 * @param offset - Camera offset [x, y, z] relative to the mesh
 * @param getOrbit - Optional getter for orbit controls (follow is skipped when orbit is enabled)
 * @returns Timeline action object for addAction()
 */
export const createCameraFollowAction = (
  camera: THREE.Camera,
  getMesh: () => THREE.Object3D | null,
  offset: CoordinateTuple,
  getOrbit: () => OrbitControls | null = () => null
): TimelineAction => ({
  name: 'camera-follow',
  category: 'camera',
  start: 0,
  action: () => {
    const mesh = getMesh()
    const orbit = getOrbit()
    if (!mesh || orbit?.enabled) return
    cameraFollowPlayer(camera, mesh, offset, orbit)
  }
})

/**
 * Creates a timeline action that moves a DirectionalLight and its target to follow a mesh
 * with a fixed world-space offset — keeping the shadow angle constant throughout the scene.
 * Must run after the physics sync action so it reads the updated mesh position.
 *
 * @param getLight - Getter returning the DirectionalLight (or null to skip)
 * @param getMesh - Getter returning the mesh to follow (or null to skip)
 * @param offset - Light offset [x, y, z] relative to the mesh
 * @returns Timeline action object for addAction()
 */
export const createDirectionalLightFollowAction = (
  getLight: () => THREE.DirectionalLight | null,
  getMesh: () => THREE.Object3D | null,
  offset: CoordinateTuple
): TimelineAction => ({
  name: 'directional-light-follow',
  category: 'camera',
  start: 0,
  action: () => {
    const light = getLight()
    const mesh = getMesh()
    if (!light || !mesh) return
    const pos = mesh.position
    light.position.set(pos.x + offset[0], pos.y + offset[1], pos.z + offset[2])
    light.target.position.set(pos.x, pos.y, pos.z)
    light.target.updateMatrixWorld()
  }
})

/**
 * Creates a timeline action that syncs a Rapier physics body's position and rotation
 * to its Three.js mesh each frame.
 *
 * @param getMesh - Getter returning the ComplexModel to sync (or null to skip)
 * @param visualYOffset - Added to Y so the mesh visual sits on the platform surface rather than inside it.
 *   With getCube origin.y=0, the geometry is shifted up by height/2 but the Rapier body center stays at
 *   position.y. Use PLATFORM_HALF_HEIGHT (0.5) to correct this.
 * @returns Timeline action object for addAction()
 */
export const createPhysicsSyncAction = (
  getMesh: () => ComplexModel | null,
  visualYOffset: number = 0
): TimelineAction => ({
  name: 'physics-sync',
  category: 'physics',
  start: 0,
  action: () => {
    const mesh = getMesh()
    if (!mesh) return
    const pos = mesh.userData.body.translation()
    mesh.position.set(pos.x, pos.y + visualYOffset, pos.z)
    const rot = mesh.userData.body.rotation()
    mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w)
  }
})

/**
 * Creates a timeline action that increments an elapsed-time ref each frame.
 * Stops incrementing when isFinished() returns true.
 *
 * @param elapsed - Reactive ref holding accumulated seconds
 * @param isFinished - Returns true when the timer should stop
 * @param getDelta - Returns delta-time in seconds for the current frame
 * @returns Timeline action object for addAction()
 */
export const createTimerAction = (
  elapsed: Ref<number>,
  isFinished: () => boolean,
  getDelta: () => number
): TimelineAction => ({
  name: 'timer',
  category: 'ui',
  start: 0,
  action: () => {
    if (isFinished()) return
    elapsed.value += getDelta()
  }
})

/**
 * Creates a timeline action that triggers onFall() when the mesh drops below a Y threshold.
 * Intended for respawn logic in platformer and ball-rolling games.
 *
 * @param getMesh - Getter returning the mesh to watch (or null to skip)
 * @param threshold - Y value below which onFall is triggered every frame
 * @param onFall - Called each frame the mesh is below threshold
 * @returns Timeline action object for addAction()
 */
export const createFallCheckAction = (
  getMesh: () => THREE.Object3D | null,
  threshold: number,
  onFall: () => void
): TimelineAction => ({
  name: 'fall-check',
  category: 'physics',
  start: 0,
  action: () => {
    const mesh = getMesh()
    if (!mesh) return
    if (mesh.position.y < threshold) onFall()
  }
})

/**
 * Creates a timeline action that translates a Three.js mesh to follow a target's X/Z
 * with a fixed Z offset. Used for ground/sky meshes that should track a moving player.
 *
 * @param getMesh - Getter returning the mesh to move (or null to skip)
 * @param getTarget - Getter returning the target whose position drives the follow (or null to skip)
 * @param offsetZ - Constant Z offset added to the target's z so the mesh stays slightly ahead/behind
 * @returns Timeline action object for addAction()
 */
export const createMeshFollowAction = (
  getMesh: () => THREE.Object3D | null,
  getTarget: () => THREE.Object3D | null,
  offsetZ: number
): TimelineAction => ({
  name: 'mesh-follow',
  category: 'environment',
  start: 0,
  action: () => {
    const mesh = getMesh()
    const target = getTarget()
    if (!mesh || !target) return
    mesh.position.x = target.position.x
    mesh.position.z = target.position.z + offsetZ
  }
})
