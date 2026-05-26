import { ref, watch, onUnmounted } from 'vue'
import * as THREE from 'three'
import { getTools, getBall, getCube } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/animation'
import {
  MARBLE_RADIUS,
  MARBLE_RESTITUTION,
  MARBLE_FRICTION,
  MARBLE_LINEAR_DAMPING,
  MARBLE_ANGULAR_DAMPING,
  MOVE_FORCE,
  MAX_LINEAR_SPEED,
  CAMERA_HEIGHT,
  CAMERA_BACK,
  CAMERA_LERP,
  FALL_THRESHOLD_Y,
  FINISH_CHECK_Z,
  FINISH_CHECK_RADIUS,
  POS_BROADCAST_MS,
  PLATFORMS,
  OBSTACLES,
  SPAWN_POSITION,
  FINISH_POSITION,
  OBSTACLE_COLOR
} from './config'
import type { GameDeps, BallPosPayload } from './types'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
type GetToolsResult = UnwrapPromise<ReturnType<typeof getTools>>
type SceneContext = Pick<GetToolsResult, 'scene' | 'world' | 'camera' | 'getDelta' | 'animate'>

type Vec3 = { x: number; y: number; z: number }
type MarbleBody = {
  translation: () => Vec3
  linvel: () => Vec3
  setLinvel: (v: Vec3, wake: boolean) => void
  applyImpulse: (v: Vec3, wake: boolean) => void
  setTranslation: (v: Vec3, wake: boolean) => void
  setAngvel: (v: Vec3, wake: boolean) => void
}

const cameraOffset = new THREE.Vector3(0, CAMERA_HEIGHT, CAMERA_BACK)
const targetCameraPos = new THREE.Vector3()
const cameraTarget = new THREE.Vector3()
const forceVec: Vec3 = { x: 0, y: 0, z: 0 }
const zeroVec: Vec3 = { x: 0, y: 0, z: 0 }

const clampSpeed = (body: MarbleBody): void => {
  const vel = body.linvel()
  const speedSq = vel.x * vel.x + vel.z * vel.z
  if (speedSq > MAX_LINEAR_SPEED * MAX_LINEAR_SPEED) {
    const scale = MAX_LINEAR_SPEED / Math.sqrt(speedSq)
    body.setLinvel({ x: vel.x * scale, y: vel.y, z: vel.z * scale }, false)
  }
}

const respawn = (body: MarbleBody): void => {
  body.setTranslation({ x: SPAWN_POSITION[0], y: SPAWN_POSITION[1], z: SPAWN_POSITION[2] }, true)
  body.setLinvel(zeroVec, true)
  body.setAngvel(zeroVec, true)
}

const applyForce = (body: MarbleBody, keys: Set<string>): void => {
  forceVec.x = 0
  forceVec.z = 0
  if (keys.has('w') || keys.has('arrowup')) forceVec.z -= MOVE_FORCE
  if (keys.has('s') || keys.has('arrowdown')) forceVec.z += MOVE_FORCE
  if (keys.has('a') || keys.has('arrowleft')) forceVec.x -= MOVE_FORCE
  if (keys.has('d') || keys.has('arrowright')) forceVec.x += MOVE_FORCE
  if (forceVec.x !== 0 || forceVec.z !== 0) {
    body.applyImpulse(forceVec, true)
    clampSpeed(body)
  }
}

const followCamera = (camera: THREE.Camera, marblePos: THREE.Vector3): void => {
  targetCameraPos.set(
    marblePos.x + cameraOffset.x,
    marblePos.y + cameraOffset.y,
    marblePos.z + cameraOffset.z
  )
  camera.position.lerp(targetCameraPos, CAMERA_LERP)
  cameraTarget.copy(marblePos)
  camera.lookAt(cameraTarget)
}

const isInFinishZone = (marblePos: THREE.Vector3): boolean => {
  if (marblePos.z >= FINISH_CHECK_Z) return false
  const dx = marblePos.x - FINISH_POSITION.x
  const dz = marblePos.z - FINISH_POSITION.z
  return Math.hypot(dx, dz) < FINISH_CHECK_RADIUS
}

const buildCourse = (scene: THREE.Scene, world: NonNullable<GetToolsResult['world']>): void => {
  PLATFORMS.forEach(({ size, position, color }) => {
    getCube(scene, world, {
      size: size as CoordinateTuple,
      position: position as CoordinateTuple,
      type: 'fixed',
      color,
      restitution: 0.2,
      friction: 0.9
    })
  })
  OBSTACLES.forEach(({ size, position }) => {
    getCube(scene, world, {
      size: size as CoordinateTuple,
      position: position as CoordinateTuple,
      type: 'fixed',
      color: OBSTACLE_COLOR,
      restitution: 0.3,
      friction: 0.5
    })
  })
}

const addFinishMarker = (scene: THREE.Scene): void => {
  const geometry = new THREE.CylinderGeometry(
    FINISH_CHECK_RADIUS * 0.5,
    FINISH_CHECK_RADIUS * 0.5,
    0.15,
    32
  )
  const material = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffd700,
    emissiveIntensity: 0.3
  })
  const disc = new THREE.Mesh(geometry, material)
  disc.position.copy(FINISH_POSITION)
  disc.position.y = 0.6
  scene.add(disc)
}

const makeGhostMarble = (scene: THREE.Scene, color: string): THREE.Mesh => {
  const geo = new THREE.SphereGeometry(MARBLE_RADIUS, 16, 16)
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.7
  })
  const mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)
  return mesh
}

/**
 * Set up and manage the MarbleMadness Three.js scene, physics, and game loop.
 * @param deps - Canvas ref, solo flag, win/position callbacks.
 * @returns Controls to init, destroy, update ghost positions, and reactive elapsed time.
 */
export const useMarbleMadnessGame = (deps: GameDeps) => {
  const elapsed = ref(0)
  const finished = ref(false)
  const keys = new Set<string>()
  let posAccumulator = 0
  let marbleMesh: THREE.Mesh | null = null
  let marbleBody: MarbleBody | null = null
  let cleanupTools: (() => void) | null = null
  const ghostMeshes = new Map<string, THREE.Mesh>()
  let sceneReference: THREE.Scene | null = null

  const onKeyDown = (e: KeyboardEvent): void => {
    keys.add(e.key.toLowerCase())
  }
  const onKeyUp = (e: KeyboardEvent): void => {
    keys.delete(e.key.toLowerCase())
  }

  const buildGame = async ({
    scene,
    world,
    camera,
    getDelta,
    animate
  }: SceneContext): Promise<void> => {
    if (!world) return
    sceneReference = scene
    buildCourse(scene, world)
    addFinishMarker(scene)

    marbleMesh = getBall(scene, world, {
      size: MARBLE_RADIUS,
      position: SPAWN_POSITION,
      restitution: MARBLE_RESTITUTION,
      friction: MARBLE_FRICTION,
      color: 0xffffff,
      segments: 16
    })
    marbleBody = marbleMesh.userData.body as MarbleBody

    if (marbleBody) {
      const rb = marbleBody as unknown as {
        setLinearDamping: (d: number) => void
        setAngularDamping: (d: number) => void
      }
      rb.setLinearDamping(MARBLE_LINEAR_DAMPING)
      rb.setAngularDamping(MARBLE_ANGULAR_DAMPING)
    }

    animate({
      beforeTimeline: () => {
        if (!marbleBody || !marbleMesh) return
        if (!finished.value) applyForce(marbleBody, keys)
        const pos = marbleBody.translation()
        marbleMesh.position.set(pos.x, pos.y, pos.z)
        followCamera(camera, marbleMesh.position)
        if (pos.y < FALL_THRESHOLD_Y) respawn(marbleBody)
        if (!finished.value && isInFinishZone(marbleMesh.position)) {
          finished.value = true
          deps.onWin()
        }
        if (!deps.isSolo.value) {
          posAccumulator += getDelta() * 1000
          if (posAccumulator >= POS_BROADCAST_MS) {
            deps.onPositionUpdate({ x: pos.x, y: pos.y, z: pos.z })
            posAccumulator = 0
          }
        }
        elapsed.value += getDelta()
      }
    })
  }

  const init = async (): Promise<void> => {
    if (!deps.canvas.value) return
    finished.value = false
    elapsed.value = 0
    posAccumulator = 0
    keys.clear()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const tools = await getTools({ canvas: deps.canvas.value })
    cleanupTools = tools.cleanup
    await tools.setup({
      config: {
        camera: {
          position: [
            SPAWN_POSITION[0],
            SPAWN_POSITION[1] + CAMERA_HEIGHT,
            SPAWN_POSITION[2] + CAMERA_BACK
          ] as CoordinateTuple
        },
        orbit: false,
        ground: false,
        sky: false,
        lights: { directional: { intensity: 1.8, position: [10, 20, 10] as CoordinateTuple } }
      },
      defineSetup: async () =>
        buildGame({
          scene: tools.scene,
          world: tools.world,
          camera: tools.camera,
          getDelta: tools.getDelta,
          animate: tools.animate
        })
    })
  }

  const destroy = (): void => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    keys.clear()
    marbleMesh = null
    marbleBody = null
    ghostMeshes.clear()
    sceneReference = null
    if (cleanupTools) {
      cleanupTools()
      cleanupTools = null
    }
  }

  const updateGhostPosition = (peerId: string, color: string, pos: BallPosPayload): void => {
    if (!sceneReference) return
    const ghost = ghostMeshes.get(peerId) ?? makeGhostMarble(sceneReference, color)
    ghostMeshes.set(peerId, ghost)
    ghost.position.set(pos.x, pos.y, pos.z)
  }

  const removeGhost = (peerId: string): void => {
    const ghost = ghostMeshes.get(peerId)
    if (ghost && sceneReference) {
      sceneReference.remove(ghost)
      ghost.geometry.dispose()
      if (ghost.material instanceof THREE.Material) ghost.material.dispose()
    }
    ghostMeshes.delete(peerId)
  }

  watch(
    () => deps.canvas.value,
    (canvas) => {
      if (!canvas) destroy()
    }
  )
  onUnmounted(destroy)

  return { elapsed, finished, init, destroy, updateGhostPosition, removeGhost }
}
