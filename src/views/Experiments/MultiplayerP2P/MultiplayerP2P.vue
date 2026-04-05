<script setup lang="ts">
import * as THREE from 'three'
import { onMounted, onUnmounted, ref } from 'vue'
import { getTools, getModel, cameraFollowPlayer, type ComplexModel } from '@webgamekit/threejs'
import {
  controllerForward,
  type CoordinateTuple,
  type AnimationData,
  updateAnimation,
  setRotation,
  getRotation,
  createTimelineManager,
  playActionTimeline
} from '@webgamekit/animation'
import { createControls, isMobile } from '@webgamekit/controls'
import {
  p2pJoin,
  p2pLeave,
  p2pIsSupported,
  p2pOnPeerJoin,
  p2pOnPeerLeave,
  p2pGetPeerIds,
  p2pSendPosition,
  p2pOnPlayers,
  p2pSendAction,
  p2pOnAction,
  type P2PSession,
  type PlayerAction
} from '@webgamekit/multiplayer-p2p'
import TouchControl from '@/components/TouchControl.vue'

const ROOM_ID = 'webgamekit-p2p'
const MOVEMENT_SPEED = 0.5
const CAMERA_HEIGHT = 7
const CAMERA_DEPTH = 14
const CAMERA_OFFSET: CoordinateTuple = [0, CAMERA_HEIGHT, CAMERA_DEPTH]
const PLAYER_Y_OFFSET = -0.5
const GROUND_SIZE = 200

const stickboySettings = {
  model: {
    position: [0, PLAYER_Y_OFFSET, 0] as CoordinateTuple,
    rotation: [0, 0, 0] as CoordinateTuple,
    scale: [1, 1, 1] as CoordinateTuple,
    restitution: -10,
    boundary: 0.5,
    hasGravity: false,
    castShadow: true,
    material: 'MeshLambertMaterial',
    color: 0xffffff
  },
  movement: {
    requireGround: true,
    maxGroundDistance: 5,
    maxStepHeight: 0.5,
    characterRadius: 1,
    debug: false
  }
}

const remoteSettings = {
  model: {
    position: [5, PLAYER_Y_OFFSET, 0] as CoordinateTuple,
    rotation: [0, 0, 0] as CoordinateTuple,
    scale: [1, 1, 1] as CoordinateTuple,
    restitution: -10,
    boundary: 0.5,
    hasGravity: false,
    castShadow: false,
    material: 'MeshLambertMaterial',
    color: 0xff6644
  },
  movement: {
    requireGround: false,
    maxGroundDistance: 5,
    maxStepHeight: 0.5,
    characterRadius: 1,
    debug: false
  }
}

const setupConfig = {
  orbit: { target: new THREE.Vector3(0, 1, 0), disabled: true },
  camera: {
    position: [0, CAMERA_HEIGHT, CAMERA_DEPTH] as CoordinateTuple,
    lookAt: [0, 0, 0],
    fov: 70,
    up: new THREE.Vector3(0, 1, 0),
    near: 0.1,
    far: 1000,
    zoom: 1,
    focus: 10
  },
  ground: { size: [GROUND_SIZE, 1, GROUND_SIZE] as CoordinateTuple, color: 0x80b966 },
  sky: { size: 500, color: 0x00aaff }
}

const controlBindings = {
  mapping: {
    keyboard: {
      a: 'move-left',
      d: 'move-right',
      w: 'move-up',
      s: 'move-down',
      '1': 'wave',
      '2': 'attack',
      '3': 'jump',
      '4': 'talk',
      '5': 'sit',
      '6': 'pick',
      '7': 'death'
    },
    gamepad: {
      'dpad-left': 'move-left',
      'dpad-right': 'move-right',
      'dpad-down': 'move-down',
      'dpad-up': 'move-up',
      'axis0-left': 'move-left',
      'axis0-right': 'move-right',
      'axis1-up': 'move-up',
      'axis1-down': 'move-down',
      cross: 'jump',
      square: 'attack',
      triangle: 'wave',
      circle: 'talk'
    },
    'faux-pad': {
      left: 'move-left',
      right: 'move-right',
      up: 'move-up',
      down: 'move-down'
    }
  },
  axisThreshold: 0.5
}

const actionConfig = {
  wave: { allowMovement: false, allowRotation: false, allowActions: [], speed: 1.5 },
  attack: { allowMovement: false, allowRotation: false, allowActions: [], speed: 2 },
  jump: { allowMovement: true, allowRotation: false, allowActions: [], speed: 1.5 },
  talk: { allowMovement: false, allowRotation: false, allowActions: [], speed: 1.5 },
  sit: { allowMovement: false, allowRotation: false, allowActions: [], speed: 1 },
  pick: { allowMovement: false, allowRotation: false, allowActions: [], speed: 1.5 },
  death: { allowMovement: false, allowRotation: false, allowActions: [], speed: 1.2 }
}

const blockingActions = new Set(Object.keys(actionConfig))

const getAnimationName = (actions: Record<string, unknown>): string => {
  const isMoving = ['move-up', 'move-down', 'move-left', 'move-right'].some((k) => actions[k])
  return isMoving ? 'walk' : 'idle'
}

const canvas = ref<HTMLCanvasElement | null>(null)
const isMobileDevice = isMobile()

let timelineManagerReference: ReturnType<typeof createTimelineManager> | null = null
let localPlayerReference: ComplexModel | null = null
let getDeltaReference: (() => number) | null = null
let p2pSession: P2PSession | null = null
const remoteModels = new Map<string, ComplexModel>()

const handleBlockingAction = (actionName: string): void => {
  if (!timelineManagerReference || !localPlayerReference || !getDeltaReference) return
  if (!blockingActions.has(actionName)) return
  const config = actionConfig[actionName as keyof typeof actionConfig]
  playActionTimeline(
    timelineManagerReference,
    localPlayerReference,
    actionName,
    getDeltaReference,
    config
  )
  if (p2pSession) p2pSendAction(p2pSession, actionName)
}

const { destroyControls, currentActions } = createControls({
  ...controlBindings,
  onAction: (action: string) => {
    handleBlockingAction(action)
  }
})

const playRemoteAction = (model: ComplexModel, action: PlayerAction): void => {
  if (!timelineManagerReference || !getDeltaReference) return
  const config = actionConfig[action.name as keyof typeof actionConfig]
  if (!config) return
  playActionTimeline(timelineManagerReference, model, action.name, getDeltaReference, config)
}

const init = async (): Promise<void> => {
  if (!canvas.value) return
  const { setup, animate, scene, world, camera, getDelta } = await getTools({
    canvas: canvas.value
  })

  const { orbit } = await setup({
    config: setupConfig,
    defineSetup: async ({ ground }) => {
      getDeltaReference = getDelta
      const groundBodies: ComplexModel[] = ground?.mesh
        ? [ground.mesh as unknown as ComplexModel]
        : []

      const localPlayer = await getModel(scene, world, 'stickboy.glb', stickboySettings.model)
      localPlayerReference = localPlayer

      const timelineManager = createTimelineManager()
      timelineManagerReference = timelineManager

      timelineManager.addAction({
        frequency: 60,
        name: 'local-player',
        category: 'user-input',
        action: () => {
          if (localPlayer.userData.performing) {
            if (!localPlayer.userData.allowMovement && !localPlayer.userData.allowRotation) return
          }

          const targetRotation = getRotation(currentActions)
          const isMoving = targetRotation !== null
          const animationData: AnimationData = {
            actionName: getAnimationName(currentActions),
            player: localPlayer,
            delta: getDelta() * 2,
            speed: 20,
            backward: false,
            distance: MOVEMENT_SPEED
          }

          if (isMoving) {
            if (localPlayer.userData.allowRotation || !localPlayer.userData.performing) {
              setRotation(localPlayer, targetRotation)
            }
            if (localPlayer.userData.allowMovement || !localPlayer.userData.performing) {
              controllerForward([], groundBodies, animationData, stickboySettings.movement)
              cameraFollowPlayer(camera, localPlayer, CAMERA_OFFSET, orbit, ['x', 'z'])
            }
          } else if (!localPlayer.userData.performing) {
            updateAnimation(animationData)
          }

          if (p2pSession) {
            p2pSendPosition(
              p2pSession,
              {
                x: localPlayer.position.x,
                y: localPlayer.position.y,
                z: localPlayer.position.z
              },
              {
                x: localPlayer.rotation.x,
                y: localPlayer.rotation.y,
                z: localPlayer.rotation.z
              }
            )
          }
        }
      })

      timelineManager.addAction({
        frequency: 60,
        name: 'remote-players',
        category: 'user-input',
        action: () => {
          remoteModels.forEach((model) => {
            if (!model.userData.performing) {
              const animData: AnimationData = {
                actionName: 'idle',
                player: model,
                delta: getDelta() * 2,
                speed: 20,
                backward: false,
                distance: 0
              }
              updateAnimation(animData)
            }
          })
        }
      })

      animate({ beforeTimeline: () => {}, timeline: timelineManager })

      if (!p2pIsSupported()) return

      const session = p2pJoin(ROOM_ID)
      p2pSession = session

      const addRemotePeer = async (peerId: string): Promise<void> => {
        if (remoteModels.has(peerId)) return
        const remoteModel = await getModel(scene, world, 'stickboy.glb', remoteSettings.model)
        remoteModels.set(peerId, remoteModel)
      }

      p2pOnPeerJoin(session, (peerId) => {
        addRemotePeer(peerId)
      })

      p2pGetPeerIds(session).forEach((peerId) => {
        addRemotePeer(peerId)
      })

      p2pOnPeerLeave(session, (peerId) => {
        const model = remoteModels.get(peerId)
        if (model) {
          scene.remove(model)
          remoteModels.delete(peerId)
        }
      })

      p2pOnPlayers(session, (playerState) => {
        const model = remoteModels.get(playerState.id)
        if (!model) return
        model.position.set(playerState.position.x, playerState.position.y, playerState.position.z)
        model.rotation.set(playerState.rotation.x, playerState.rotation.y, playerState.rotation.z)
        if (!model.userData.performing) {
          const animData: AnimationData = {
            actionName: 'walk',
            player: model,
            delta: getDelta() * 2,
            speed: 20,
            backward: false,
            distance: 0
          }
          updateAnimation(animData)
        }
      })

      p2pOnAction(session, (peerId, action) => {
        const model = remoteModels.get(peerId)
        if (!model) return
        playRemoteAction(model, action)
      })
    }
  })
}

onMounted(async () => {
  await init()
  window.addEventListener('resize', init)
})

onUnmounted(() => {
  destroyControls()
  window.removeEventListener('resize', init)
  if (p2pSession) {
    p2pLeave(p2pSession)
    p2pSession = null
  }
})
</script>

<template>
  <canvas ref="canvas"></canvas>
  <template v-if="isMobileDevice">
    <TouchControl
      style="left: 25px; bottom: 25px"
      :mapping="{
        left: 'move-left',
        right: 'move-right',
        up: 'move-up',
        down: 'move-down'
      }"
      :options="{ deadzone: 0.15, enableEightWay: true }"
      :current-actions="currentActions"
      :on-action="(a: string) => handleBlockingAction(a)"
    />
    <TouchControl
      style="right: 25px; bottom: 25px"
      mode="button"
      :mapping="{ Wave: 'wave', Attack: 'attack', Jump: 'jump', Talk: 'talk' }"
      :on-action="(a: string) => handleBlockingAction(a)"
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
