<script setup lang="ts">
import * as THREE from 'three'
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import {
  getTools,
  getModel,
  followCameraPlacement,
  followCameraCalibrate,
  type ComplexModel,
  type FollowCameraConfig,
  type FollowCameraMode
} from '@webgamekit/threejs'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { registerFollowCameraPanel, type FollowCameraPanel } from '@/utils/followCameraPanel'
import {
  controllerForward,
  type CoordinateTuple,
  type AnimationData,
  updateAnimation,
  updatePlayerFacing,
  createTimelineManager,
  playActionTimeline
} from '@webgamekit/animation'
import { createControls, isMobile } from '@webgamekit/controls'

import TouchControl from '@/components/TouchControl.vue'
import ControlsLogger from '@/components/ControlsLogger.vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import type { LoadProgress } from '@webgamekit/threejs'
import grassTextureImg from '@/assets/images/textures/grass.jpg'
import { getActionName } from './MixamoPlayground.helpers'
import { useDebugSceneStore } from '@/stores/debugScene'

const PLAYER_NAME = 'player'

const playerSettings = {
  model: {
    name: PLAYER_NAME,
    position: [0, -1, 0] as CoordinateTuple,
    rotation: [0, 0, 0] as CoordinateTuple,
    scale: [0.15, 0.15, 0.15] as CoordinateTuple,
    restitution: -10,
    boundary: 0.5,
    hasGravity: false,
    castShadow: true,
    material: 'MeshLambertMaterial',
    animations: [
      'animations/walk2.fbx',
      'animations/idle.fbx',
      'animations/running.fbx',
      'animations/roll.fbx',
      'animations/kick.fbx',
      'animations/punch.fbx',
      'animations/jump.fbx'
    ],
    color: 0xffffff
  },
  movement: {
    requireGround: true,
    maxGroundDistance: 5,
    maxStepHeight: 0.5,
    characterRadius: 4,
    debug: false
  },
  game: {
    distance: 0.5,
    speed: {
      movement: 2,
      turning: 4
    }
  }
}

const setupConfig = {
  orbit: {
    target: new THREE.Vector3(0, 15, 0),
    disabled: true
  },
  camera: {
    // Above the look-at target at y 15 rather than below it, so the character is framed from
    // slightly above instead of the shot craning up at them from knee height.
    position: [0, 18, 35],
    lookAt: [0, 0, 0],
    fov: 80,
    up: new THREE.Vector3(0, 1, 0),
    near: 0.1,
    far: 1000,
    zoom: 1,
    focus: 10
  },
  ground: {
    size: [1000, 100, 1000],
    texture: grassTextureImg,
    textureRepeat: [100, 100] as [number, number],
    color: 0x80b966
  },
  sky: { size: 500, color: 0x00aaff }
}

const controlBindings = {
  mapping: {
    keyboard: {
      a: 'move-left',
      d: 'move-right',
      w: 'move-down',
      s: 'move-up',
      p: 'print-log',
      Enter: 'run',
      ' ': 'jump',
      ArrowUp: 'jump',
      ArrowLeft: 'kick',
      ArrowRight: 'punch',
      ArrowDown: 'roll'
    },
    gamepad: {
      // Buttons
      cross: 'jump',
      square: 'kick',
      triangle: 'punch',
      circle: 'roll',
      'dpad-left': 'move-left',
      'dpad-right': 'move-right',
      'dpad-down': 'move-up',
      'dpad-up': 'move-down',
      'axis0-left': 'move-left',
      'axis0-right': 'move-right',
      'axis1-up': 'move-down',
      'axis1-down': 'move-up'
    },
    'faux-pad': {
      left: 'move-left',
      right: 'move-right',
      up: 'move-down',
      down: 'move-up'
    }
  },
  axisThreshold: 0.5
}

const actionConfig = {
  kick: { allowMovement: false, allowRotation: false, allowActions: [], speed: 2 },
  punch: { allowMovement: false, allowRotation: false, allowActions: [], speed: 2 },
  jump: { allowMovement: true, allowRotation: false, allowActions: ['roll'], speed: 2 },
  roll: { allowMovement: false, allowRotation: false, allowActions: [], speed: 2 }
}

// Store references for blocking actions
let timelineManagerReference: ReturnType<typeof createTimelineManager> | null = null
let playerReference: ComplexModel | null = null
let followPanel: FollowCameraPanel | null = null
const followMode = ref<FollowCameraMode>('third')
/** The camera actually being rendered, which the panel can replace with another projection. */
const activeCamera: { current: THREE.Camera | null } = { current: null }

// Pre-allocated: read every frame, and the animation loop must not allocate.
const followTargetPosition = new THREE.Vector3()
const followTargetDirection = new THREE.Vector3()
const FORWARD = new THREE.Vector3(0, 0, 1)
/** The heading the shot was calibrated against, held while Follow rotation is off. */
const referenceHeading = new THREE.Vector3(0, 0, 1)

/**
 * The object the camera panel is pointing at, resolved from the scene by name.
 * @param scene The scene holding the candidates
 * @returns The chosen object, or null while nothing is selected
 */
const followTarget = (scene: THREE.Scene): THREE.Object3D | null => {
  const name = followPanel?.targetName.value
  return name ? (scene.getObjectByName(name) ?? null) : null
}

/**
 * The offsets that keep the camera exactly where it is relative to what it follows.
 * @param scene The scene holding the follow target
 * @param targetName The element to measure against, named by the rig
 * @returns The offsets to adopt, or null while there is nothing to measure against
 */
const calibrateFromScene = (
  scene: THREE.Scene,
  targetName: string | null
): Partial<FollowCameraConfig> | null => {
  const camera = activeCamera.current
  const target = targetName ? scene.getObjectByName(targetName) : null
  if (!camera || !target) return null

  followTargetPosition.copy(target.position)
  followTargetDirection.copy(FORWARD).applyQuaternion(target.quaternion).setY(0).normalize()
  referenceHeading.copy(followTargetDirection)
  return followCameraCalibrate(
    followMode.value,
    camera.position,
    followTargetPosition,
    followTargetDirection
  )
}

/**
 * Places the camera behind whatever the panel is following, every frame.
 *
 * Its own action rather than a line inside the movement one: placing the camera only on the
 * frames the player happened to walk left it behind the moment they stopped, and never centred
 * it at all until they first moved.
 * @param scene The scene holding the follow target
 * @param getOrbit Reads the controls that own the aim, which do not exist yet at registration
 * @returns A timeline action the caller registers
 */
const followCameraAction = (scene: THREE.Scene, getOrbit: () => OrbitControls | null) => ({
  name: 'Follow camera',
  category: 'visual' as const,
  action: () => {
    const camera = activeCamera.current
    const target = followTarget(scene)
    if (!camera || !target || !followPanel?.enabled.value) return

    followTargetPosition.copy(target.position)
    // Off, the shot keeps the heading it was calibrated against and simply travels with the
    // target, rather than spinning round every time the character turns on the spot.
    if (followPanel.config.followRotation) {
      followTargetDirection.copy(FORWARD).applyQuaternion(target.quaternion).setY(0).normalize()
    } else {
      followTargetDirection.copy(referenceHeading)
    }

    const placement = followCameraPlacement(
      followMode.value,
      followTargetPosition,
      followTargetDirection,
      followPanel.config
    )
    camera.position.copy(placement.position)
    // orbit.update() runs after the timeline and re-aims at its own target, so the aim is
    // written there rather than through camera.lookAt.
    const orbit = getOrbit()
    if (orbit) orbit.target.copy(placement.lookAt)
    else camera.lookAt(placement.lookAt)
  }
})
let getDeltaReference: (() => number) | null = null

const handleBlockingAction = (actionName: string): void => {
  if (!timelineManagerReference || !playerReference || !getDeltaReference) return

  const config = actionConfig[actionName as keyof typeof actionConfig]
  if (config) {
    playActionTimeline(
      timelineManagerReference,
      playerReference,
      actionName,
      getDeltaReference,
      config
    )
  }
}

const logs = shallowRef<string[]>([])
const showLogs = true
const isMobileDevice = isMobile()

const loadingVisible = ref(true)
const loadingStage = ref('Loading…')
const loadingDetail = ref<string | undefined>(undefined)

const handleProgress = (progress: LoadProgress): void => {
  loadingVisible.value = !progress.done
  loadingStage.value = progress.stage
  loadingDetail.value = progress.detail
}

const getActionData = (
  player: ComplexModel,
  currentActions: Record<string, any>,
  basicDistance: number,
  getDelta: () => number
): AnimationData => {
  const actionName = getActionName(currentActions)
  const distance = currentActions['run'] ? basicDistance * 2 : basicDistance
  return {
    actionName,
    player,
    delta: getDelta() * 2,
    speed: 20,
    backward: false,
    distance
  }
}

const getLogs = (actions: Record<string, any>): string[] =>
  Object.keys(actions)
    .filter((action) => !!actions[action])
    .map((action) => `${action} triggered by ${actions[action].trigger} ${actions[action].device}`)

const bindings = {
  ...controlBindings,
  onAction: (action: string) => {
    logs.value = getLogs(currentActions)

    switch (action) {
      case 'print-log':
        break
      default:
        handleBlockingAction(action)
        break
    }
  },
  onRelease: () => {
    logs.value = getLogs(currentActions)
  }
}
const { destroyControls, currentActions } = createControls(bindings)

const { registerSceneElements, clearSceneElements } = useDebugSceneStore()

const canvas = ref<HTMLCanvasElement | null>(null)
const init = async (): Promise<void> => {
  if (!canvas.value) return
  const { setup, animate, scene, world, camera, getDelta, renderer, setActiveCamera } =
    await getTools({
      canvas: canvas.value,
      onProgress: handleProgress
    })
  const { orbit } = await setup({
    config: setupConfig,
    defineSetup: async ({ ground }) => {
      const { distance, speed } = playerSettings.game
      const { movement } = playerSettings
      const obstacles: ComplexModel[] = []

      const player = await getModel(scene, world, 'character2.fbx', {
        ...playerSettings.model,
        onProgress: handleProgress
      })
      // console.log(player.userData.actions)
      const groundBodies: ComplexModel[] = ground?.mesh
        ? [ground.mesh as unknown as ComplexModel]
        : []

      const timelineManager = createTimelineManager()

      // Set refs for blocking actions
      timelineManagerReference = timelineManager
      playerReference = player
      getDeltaReference = getDelta
      timelineManager.addAction({
        frequency: speed.movement,
        name: 'Walk',
        category: 'user-input',
        action: () => {
          // Skip movement/animation updates when a blocking action is performing
          if (player.userData.performing) {
            // Only allow movement/rotation if the blocking action permits it
            if (!player.userData.allowMovement && !player.userData.allowRotation) {
              return
            }
          }

          const targetRotation = updatePlayerFacing(player, currentActions)
          const isMoving = targetRotation !== null
          const animationData: AnimationData = getActionData(
            player,
            currentActions,
            distance,
            getDelta
          )

          if (isMoving) {
            animationData.targetRotation = targetRotation

            // Only move if allowed
            if (player.userData.allowMovement || !player.userData.performing) {
              controllerForward(obstacles, groundBodies, animationData, movement)
            }
          } else if (!player.userData.performing) {
            // Only update idle animation if not performing a blocking action
            updateAnimation(animationData)
          }
        }
      })

      // A getter, not the value: this runs inside defineSetup, where `orbit` is still being
      // assigned by the very setup call that is running.
      timelineManager.addAction(followCameraAction(scene, () => orbit))

      animate({
        beforeTimeline: () => {},
        timeline: timelineManager
      })
    }
  })
  // The fourth argument is an options object, not the renderer. Passing it bare meant every
  // field read as undefined: no perf renderer, no orbit sync, and no camera swap — which is
  // what left the panel's Orthographic button permanently disabled.
  activeCamera.current = camera
  registerSceneElements(
    camera,
    scene.children.filter((c) => c !== camera),
    undefined,
    {
      renderer,
      orbit,
      setCamera: (newCamera) => {
        activeCamera.current = newCamera
        return setActiveCamera(newCamera)
      }
    }
  )

  // After the element list exists, so the rig can offer what is in it as follow targets.
  followPanel = registerFollowCameraPanel({
    mode: followMode,
    setMode: (mode) => {
      followMode.value = mode
    },
    // Follows from the start, holding the framing the scene declared rather than snapping to
    // offsets picked elsewhere: switching the rig on measures what the camera already has.
    followOnStart: true,
    // This scene introduces its character face-on and is framed from that side; swinging the
    // shot round every time they turn would throw that framing away.
    defaults: { followRotation: false },
    calibrate: (targetName) => calibrateFromScene(scene, targetName)
  })
}

onMounted(async () => {
  await init()
  window.addEventListener('resize', init)
})
onUnmounted(() => {
  destroyControls()
  window.removeEventListener('resize', init)
  followPanel?.teardown()
  followPanel = null
  activeCamera.current = null
  clearSceneElements()
})
</script>

<template>
  <canvas ref="canvas"></canvas>
  <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
  <ControlsLogger v-if="showLogs" :logs="logs" />

  <template v-if="isMobileDevice">
    <TouchControl
      style="left: 25px; bottom: 25px"
      :mapping="{
        left: 'move-left',
        right: 'move-right',
        up: 'move-down',
        down: 'move-up'
      }"
      :options="{ deadzone: 0.15, enableEightWay: true }"
      :current-actions="currentActions"
      :on-action="bindings.onAction"
    />
    <TouchControl
      style="right: 25px; bottom: 25px"
      mode="button"
      :mapping="{ Kick: 'kick', Punch: 'punch', Jump: 'jump', Roll: 'roll' }"
      :on-action="bindings.onAction"
    />
  </template>
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
</style>
