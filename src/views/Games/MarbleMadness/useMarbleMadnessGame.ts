import { ref, watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  getTools,
  getBall,
  getCube,
  cameraFollowPlayer,
  moveDynamic,
  type ComplexModel
} from '@webgamekit/threejs'
import { createControls } from '@webgamekit/controls'
import type { ControlsExtras, ControlsCurrents } from '@webgamekit/controls'
import { createTimelineManager, type CoordinateTuple } from '@webgamekit/animation'
import { registerCameraProperties } from '@/utils/cameraProperties'
import {
  MARBLE_RADIUS,
  MARBLE_WEIGHT,
  MARBLE_RESTITUTION,
  MARBLE_FRICTION,
  MARBLE_LINEAR_DAMPING,
  MARBLE_ANGULAR_DAMPING,
  MOVE_FORCE,
  MAX_LINEAR_SPEED,
  CAMERA_HEIGHT,
  CAMERA_BACK,
  FALL_THRESHOLD_Y,
  TIME_PENALTY_FALL,
  POS_BROADCAST_MS,
  OBSTACLE_COLOR,
  KEYBOARD_MAPPING,
  LIGHT_AMBIENT_INTENSITY,
  LIGHT_DIRECTIONAL_INTENSITY,
  LIGHT_DIRECTIONAL_POSITION,
  FINISH_DISC_RADIUS_RATIO,
  type TrackConfig
} from './config'
import type { GameDeps, BallPosPayload } from './types'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
type GetToolsResult = UnwrapPromise<ReturnType<typeof getTools>>
type SceneContext = Omit<
  Pick<GetToolsResult, 'scene' | 'world' | 'camera' | 'getDelta' | 'animate' | 'orbit'>,
  'orbit'
> & {
  orbit: OrbitControls | null
}

type Vec3 = { x: number; y: number; z: number }

type MarbleState = {
  marbleMesh: ComplexModel | null
  controls: ControlsExtras | null
  posAccumulator: number
  finished: Ref<boolean>
  elapsed: Ref<number>
  penaltyCount: Ref<number>
}

const CAMERA_OFFSET: CoordinateTuple = [0, CAMERA_HEIGHT, CAMERA_BACK]
const FINISH_DISC_HEIGHT = 0.6
const FINISH_DISC_THICKNESS = 0.15
const FINISH_DISC_SEGMENTS = 32

const applyDamping = (model: ComplexModel): void => {
  model.userData.body.setLinearDamping(MARBLE_LINEAR_DAMPING)
  model.userData.body.setAngularDamping(MARBLE_ANGULAR_DAMPING)
}

const respawn = (model: ComplexModel, spawnPosition: CoordinateTuple): void => {
  model.userData.body.setTranslation(
    { x: spawnPosition[0], y: spawnPosition[1], z: spawnPosition[2] },
    true
  )
  model.userData.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  model.userData.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
}

const computeImpulse = (currentActions: ControlsCurrents): Vec3 => {
  const x =
    ('left' in currentActions ? -MOVE_FORCE : 0) + ('right' in currentActions ? MOVE_FORCE : 0)
  const z =
    ('forward' in currentActions ? -MOVE_FORCE : 0) +
    ('backward' in currentActions ? MOVE_FORCE : 0)
  return { x, y: 0, z }
}

const isInFinishZone = (pos: THREE.Vector3, track: TrackConfig): boolean => {
  if (pos.z >= track.finishCheckZ) return false
  const dx = pos.x - track.finishPosition[0]
  const dz = pos.z - track.finishPosition[2]
  return Math.hypot(dx, dz) < track.finishCheckRadius
}

const buildCourse = (
  scene: THREE.Scene,
  world: NonNullable<GetToolsResult['world']>,
  track: TrackConfig
): void => {
  track.platforms.forEach(({ size, position, color, rotation }) => {
    getCube(scene, world, {
      size: size as CoordinateTuple,
      position: position as CoordinateTuple,
      rotation: rotation as CoordinateTuple | undefined,
      type: 'fixed',
      color,
      restitution: 0.2,
      friction: 0.9
    })
  })
  track.obstacles.forEach(({ size, position }) => {
    getCube(scene, world, {
      size: size as CoordinateTuple,
      position: position as CoordinateTuple,
      type: 'fixed',
      color: OBSTACLE_COLOR,
      restitution: 0.1,
      friction: 0.5
    })
  })
}

const addFinishMarker = (scene: THREE.Scene, track: TrackConfig): void => {
  const discRadius = track.finishCheckRadius * FINISH_DISC_RADIUS_RATIO
  const geometry = new THREE.CylinderGeometry(
    discRadius,
    discRadius,
    FINISH_DISC_THICKNESS,
    FINISH_DISC_SEGMENTS
  )
  const material = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffd700,
    emissiveIntensity: 0.3
  })
  const disc = new THREE.Mesh(geometry, material)
  disc.position.set(track.finishPosition[0], FINISH_DISC_HEIGHT, track.finishPosition[2])
  scene.add(disc)
}

const makeGhostMarble = (scene: THREE.Scene, colorHex: number, texture?: string): THREE.Mesh =>
  getBall(scene, undefined, {
    size: MARBLE_RADIUS,
    color: colorHex,
    texture,
    transparent: true,
    opacity: 0.7,
    segments: 16
  })

const buildTimeline = (
  camera: THREE.Camera,
  getDelta: () => number,
  state: MarbleState,
  deps: GameDeps,
  orbit: OrbitControls | null
) => {
  const timeline = createTimelineManager()

  timeline.addAction({
    name: 'marble-input',
    category: 'physics',
    start: 0,
    action: () => {
      if (!state.marbleMesh || state.finished.value || !state.controls) return
      const impulse = computeImpulse(state.controls.currentActions)
      if (impulse.x !== 0 || impulse.z !== 0) {
        moveDynamic(state.marbleMesh, impulse, MAX_LINEAR_SPEED)
      }
    }
  })

  timeline.addAction({
    name: 'marble-sync',
    category: 'physics',
    start: 0,
    action: () => {
      if (!state.marbleMesh) return
      const pos = state.marbleMesh.userData.body.translation()
      state.marbleMesh.position.set(pos.x, pos.y, pos.z)
      const rot = state.marbleMesh.userData.body.rotation()
      state.marbleMesh.quaternion.set(rot.x, rot.y, rot.z, rot.w)
    }
  })

  timeline.addAction({
    name: 'camera-follow',
    category: 'camera',
    start: 0,
    action: () => {
      if (!state.marbleMesh || orbit?.enabled) return
      cameraFollowPlayer(camera, state.marbleMesh, CAMERA_OFFSET, orbit)
    }
  })

  timeline.addAction({
    name: 'fall-check',
    category: 'physics',
    start: 0,
    action: () => {
      if (!state.marbleMesh) return
      if (state.marbleMesh.position.y < FALL_THRESHOLD_Y) {
        state.elapsed.value += TIME_PENALTY_FALL
        state.penaltyCount.value += 1
        respawn(state.marbleMesh, deps.track.value.spawnPosition)
      }
    }
  })

  timeline.addAction({
    name: 'finish-check',
    category: 'game',
    start: 0,
    action: () => {
      if (!state.marbleMesh || state.finished.value) return
      if (isInFinishZone(state.marbleMesh.position, deps.track.value)) {
        state.finished.value = true
        deps.onWin()
      }
    }
  })

  timeline.addAction({
    name: 'pos-broadcast',
    category: 'network',
    start: 0,
    action: () => {
      if (deps.isSolo.value || !state.marbleMesh) return
      state.posAccumulator += getDelta() * 1000
      if (state.posAccumulator >= POS_BROADCAST_MS) {
        const pos = state.marbleMesh.userData.body.translation()
        deps.onPositionUpdate({ x: pos.x, y: pos.y, z: pos.z })
        state.posAccumulator = 0
      }
    }
  })

  timeline.addAction({
    name: 'timer',
    category: 'ui',
    start: 0,
    action: () => {
      if (state.finished.value) return
      state.elapsed.value += getDelta()
    }
  })

  return timeline
}

/**
 * Set up and manage the MarbleMadness Three.js scene, physics, and game loop.
 * @param deps - Canvas ref, solo flag, track config, win/position callbacks.
 * @returns Controls to init, destroy, update ghost positions, and reactive elapsed time.
 */
export const useMarbleMadnessGame = (deps: GameDeps) => {
  const state: MarbleState = {
    marbleMesh: null,
    controls: null,
    posAccumulator: 0,
    finished: ref(false),
    elapsed: ref(0),
    penaltyCount: ref(0)
  }
  let cleanupTools: (() => void) | null = null
  const ghostMeshes = new Map<string, THREE.Mesh>()
  let sceneReference: THREE.Scene | null = null

  const buildGame = async ({ scene, world, camera, getDelta, animate, orbit }: SceneContext) => {
    if (!world) return
    sceneReference = scene
    const track = deps.track.value
    buildCourse(scene, world, track)
    addFinishMarker(scene, track)
    state.marbleMesh = getBall(scene, world, {
      size: MARBLE_RADIUS,
      position: track.spawnPosition,
      restitution: MARBLE_RESTITUTION,
      friction: MARBLE_FRICTION,
      weight: MARBLE_WEIGHT,
      texture: deps.marble.value,
      segments: 32,
      type: 'dynamic'
    }) as unknown as ComplexModel
    applyDamping(state.marbleMesh)
    animate({ timeline: buildTimeline(camera, getDelta, state, deps, orbit) })
  }

  const init = async (): Promise<void> => {
    if (!deps.canvas.value) return
    state.finished.value = false
    state.elapsed.value = 0
    state.penaltyCount.value = 0
    state.posAccumulator = 0
    state.controls = createControls({ mapping: KEYBOARD_MAPPING })
    const track = deps.track.value
    const tools = await getTools({ canvas: deps.canvas.value })
    cleanupTools = tools.cleanup
    await tools.setup({
      config: {
        camera: {
          position: [
            track.spawnPosition[0],
            track.spawnPosition[1] + CAMERA_HEIGHT,
            track.spawnPosition[2] + CAMERA_BACK
          ] as CoordinateTuple
        },
        orbit: { disabled: true },
        ground: false,
        sky: false,
        lights: {
          ambient: { intensity: LIGHT_AMBIENT_INTENSITY },
          directional: {
            intensity: LIGHT_DIRECTIONAL_INTENSITY,
            position: LIGHT_DIRECTIONAL_POSITION as CoordinateTuple
          }
        }
      },
      defineSetup: async ({ orbit }) => {
        await buildGame({
          scene: tools.scene,
          world: tools.world,
          camera: tools.camera,
          getDelta: tools.getDelta,
          animate: tools.animate,
          orbit
        })
        registerCameraProperties({ camera: tools.camera, orbit })
      }
    })
  }

  const destroy = (): void => {
    state.controls?.destroyControls()
    state.marbleMesh = null
    state.controls = null
    ghostMeshes.clear()
    sceneReference = null
    if (cleanupTools) {
      cleanupTools()
      cleanupTools = null
    }
  }

  const updateGhostPosition = (
    peerId: string,
    colorHex: number,
    pos: BallPosPayload,
    texture?: string
  ): void => {
    if (!sceneReference) return
    const ghost = ghostMeshes.get(peerId) ?? makeGhostMarble(sceneReference, colorHex, texture)
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

  return {
    elapsed: state.elapsed,
    finished: state.finished,
    penaltyCount: state.penaltyCount,
    init,
    destroy,
    updateGhostPosition,
    removeGhost
  }
}
