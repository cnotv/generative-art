<script setup lang="ts">
import * as THREE from 'three'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getTools, getModel, cameraFollowPlayer, type ComplexModel } from '@webgamekit/threejs'
import {
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
  p2pSendData,
  p2pOnData,
  type P2PSession,
  type PlayerAction
} from '@webgamekit/multiplayer-p2p'
import { textureBuildCombined, textureToDataUrl } from '@webgamekit/canvas-editor'
import TextureEditor from './TextureEditor.vue'
import TouchControl from '@/components/TouchControl.vue'
import ControlsLogger from '@/components/ControlsLogger.vue'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'
import { usePanelsStore } from '@/stores/panels'
import { useDebugSceneStore } from '@/stores/debugScene'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import { registerObjectProperties } from '@/utils/objectProperties'
import stickmanFront from '@/assets/images/characters/stickman_front.webp'
import stickmanBack from '@/assets/images/characters/stickman_back.webp'
import silhouette from '@/assets/images/characters/silhouette.webp'

const ROOM_ID = 'webgamekit-p2p'
const MOVEMENT_SPEED = 0.25
const IDLE_ANIM_SPEED = 5
const WALK_ANIM_SPEED = 20
const CAMERA_HEIGHT = 7
const CAMERA_DEPTH = 14
const CAMERA_OFFSET: CoordinateTuple = [0, CAMERA_HEIGHT, CAMERA_DEPTH]
const PLAYER_SCALE = 2
const PLAYER_Y_OFFSET = -2
const GROUND_SIZE = 200

const reactiveConfig = createReactiveConfig({
  useTexture: true,
  transparentModel: true,
  frontTexture: stickmanFront as string,
  backTexture: stickmanBack as string
})

const configControls = {
  useTexture: { boolean: true, label: 'Use Texture' },
  transparentModel: { boolean: true, label: 'Transparent Model' },
  frontTexture: { file: 'image/*', label: 'Front Texture' },
  backTexture: { file: 'image/*', label: 'Back Texture' }
}

const stickboySettings = {
  position: [0, PLAYER_Y_OFFSET, 0] as CoordinateTuple,
  rotation: [0, 0, 0] as CoordinateTuple,
  scale: [PLAYER_SCALE, PLAYER_SCALE, PLAYER_SCALE] as CoordinateTuple,
  restitution: -10,
  boundary: 0.5,
  hasGravity: false,
  castShadow: true,
  material: 'MeshLambertMaterial',
  color: 0xffffff
}

const remoteSettings = {
  position: [0, PLAYER_Y_OFFSET, 0] as CoordinateTuple,
  rotation: [0, 0, 0] as CoordinateTuple,
  scale: [PLAYER_SCALE, PLAYER_SCALE, PLAYER_SCALE] as CoordinateTuple,
  restitution: -10,
  boundary: 0.5,
  hasGravity: false,
  castShadow: true,
  material: 'MeshLambertMaterial',
  color: 0xff6644
}

const FRONT_FACE_THRESHOLD = 0.5
const BACK_FACE_THRESHOLD = -0.5

const ALPHA_TEST_THRESHOLD = 0.5
const TEXTURE_HALF = 0.5
const LIGHT_X = 20
const LIGHT_Y = 50
const LIGHT_Z = 20
const LIGHT_POSITION: CoordinateTuple = [LIGHT_X, LIGHT_Y, LIGHT_Z]
const P2P_TEXTURE_CHANNEL = 'texture'

const combinedTextureMap = ref<THREE.CanvasTexture | null>(null)

const remapUVsToWorldProjection = (model: THREE.Object3D): void => {
  const boundingBox = new THREE.Box3().setFromObject(model)
  const size = new THREE.Vector3()
  boundingBox.getSize(size)

  const worldPosition = new THREE.Vector3()
  const worldNormal = new THREE.Vector3()
  const normalMatrix = new THREE.Matrix3()

  model.traverse((child: THREE.Object3D) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return

    const geometry = mesh.geometry
    const uv = geometry.attributes.uv
    const position = geometry.attributes.position
    const normal = geometry.attributes.normal
    if (!uv || !position || !normal) return

    mesh.updateMatrixWorld(true)
    normalMatrix.getNormalMatrix(mesh.matrixWorld)

    Array.from({ length: position.count }).forEach((_, i) => {
      worldNormal.set(normal.getX(i), normal.getY(i), normal.getZ(i))
      worldNormal.applyMatrix3(normalMatrix).normalize()

      const isModelFront = worldNormal.z < BACK_FACE_THRESHOLD
      const isModelBack = worldNormal.z > FRONT_FACE_THRESHOLD

      if (isModelFront || isModelBack) {
        worldPosition.set(position.getX(i), position.getY(i), position.getZ(i))
        mesh.localToWorld(worldPosition)

        const normalizedX = (worldPosition.x - boundingBox.min.x) / size.x
        const v = (worldPosition.y - boundingBox.min.y) / size.y
        const u = isModelFront
          ? (1 - normalizedX) * TEXTURE_HALF
          : TEXTURE_HALF + normalizedX * TEXTURE_HALF
        uv.setXY(i, u, v)
      } else {
        uv.setXY(i, 0, 0)
      }
    })

    uv.needsUpdate = true
  })
}

const applyTextureToModel = (model: ComplexModel): void => {
  const { useTexture, transparentModel } = reactiveConfig.value
  model.traverse((child: THREE.Object3D) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const material = mesh.material as THREE.MeshLambertMaterial
    material.map = useTexture ? combinedTextureMap.value : null
    material.transparent = transparentModel
    material.alphaTest = transparentModel ? ALPHA_TEST_THRESHOLD : 0
    material.needsUpdate = true
  })
}

const refreshAllModels = (): void => {
  if (localPlayerReference) applyTextureToModel(localPlayerReference)
  remoteModels.forEach((model) => applyTextureToModel(model))
}

const buildAndApplyTexture = async (front: string, back: string | null): Promise<void> => {
  const canvas = await textureBuildCombined(front, back)
  combinedTextureMap.value = new THREE.CanvasTexture(canvas)
  refreshAllModels()
  if (p2pSession) {
    p2pSendData(p2pSession, P2P_TEXTURE_CHANNEL, { dataUrl: textureToDataUrl(canvas) })
  }
}

const rebuildTexture = async (): Promise<void> => {
  const front = reactiveConfig.value.frontTexture || (stickmanFront as string)
  const back = reactiveConfig.value.backTexture || null
  await buildAndApplyTexture(front, back)
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
  sky: { size: 500, color: 0x00aaff },
  lights: {
    directional: {
      position: LIGHT_POSITION,
      castShadow: true,
      shadow: {
        mapSize: { width: 4096, height: 4096 },
        camera: { near: 0.5, far: 300, left: -120, right: 120, top: 120, bottom: -120 },
        bias: -0.0005
      }
    }
  }
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
  wave: { allowMovement: true, allowRotation: false, allowActions: [], speed: 1.5 },
  attack: { allowMovement: true, allowRotation: false, allowActions: [], speed: 2 },
  jump: { allowMovement: true, allowRotation: false, allowActions: [], speed: 1.5 },
  talk: { allowMovement: true, allowRotation: false, allowActions: [], speed: 1.5 },
  sit: { allowMovement: true, allowRotation: false, allowActions: [], speed: 1 },
  pick: { allowMovement: true, allowRotation: false, allowActions: [], speed: 1.5 },
  death: { allowMovement: true, allowRotation: false, allowActions: [], speed: 1.2 }
}

const blockingActions = new Set(Object.keys(actionConfig))

const getAnimationName = (actions: Record<string, unknown>): string => {
  const isMoving = ['move-up', 'move-down', 'move-left', 'move-right'].some((k) => actions[k])
  return isMoving ? 'walk' : 'idle'
}

const route = useRoute()
const { registerSceneElements, clearSceneElements } = useDebugSceneStore()
const { clearAllElementProperties } = useElementPropertiesStore()
const panelsStore = usePanelsStore()
const canvas = ref<HTMLCanvasElement | null>(null)
const isMobileDevice = isMobile()
const peerCount = ref(0)

const hudLogs = computed(() => [
  `Players: ${peerCount.value + 1}`,
  '',
  'WASD — move',
  '1 wave  2 attack  3 jump',
  '4 talk  5 sit  6 pick  7 death'
])

let timelineManagerReference: ReturnType<typeof createTimelineManager> | null = null
let localPlayerReference: ComplexModel | null = null
let getDeltaReference: (() => number) | null = null
let p2pSession: P2PSession | null = null
const remoteModels = new Map<string, ComplexModel>()
const movingPeers = new Set<string>()

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
      const movementDirection = new THREE.Vector3()
      const broadcastPosition = { x: 0, y: 0, z: 0 }
      const broadcastRotation = { x: 0, y: 0, z: 0 }

      await rebuildTexture()

      const localPlayer = await getModel(scene, world, 'stickboy.glb', stickboySettings)
      localPlayerReference = localPlayer
      remapUVsToWorldProjection(localPlayer)
      applyTextureToModel(localPlayer)

      registerSceneElements(camera, [localPlayer])
      registerObjectProperties({ object: localPlayer, name: 'local-player', title: 'Local Player' })

      const timelineManager = createTimelineManager()
      timelineManagerReference = timelineManager

      timelineManager.addAction({
        frequency: 2,
        name: 'local-player',
        category: 'user-input',
        action: () => {
          if (localPlayer.userData.performing) {
            if (!localPlayer.userData.allowMovement && !localPlayer.userData.allowRotation) return
          }

          const targetRotation = getRotation(currentActions)
          const isMoving = targetRotation !== null
          const animationName = getAnimationName(currentActions)
          const animationData: AnimationData = {
            actionName: animationName,
            player: localPlayer,
            delta: getDelta() * 2,
            speed: animationName === 'walk' ? WALK_ANIM_SPEED : IDLE_ANIM_SPEED,
            backward: false,
            distance: MOVEMENT_SPEED
          }

          if (isMoving) {
            if (localPlayer.userData.allowRotation || !localPlayer.userData.performing) {
              setRotation(localPlayer, targetRotation)
            }
            if (localPlayer.userData.allowMovement || !localPlayer.userData.performing) {
              localPlayer.getWorldDirection(movementDirection)
              localPlayer.position.x += movementDirection.x * MOVEMENT_SPEED
              localPlayer.position.z += movementDirection.z * MOVEMENT_SPEED
              localPlayer.position.y = PLAYER_Y_OFFSET
              if (localPlayer.userData.body) {
                localPlayer.userData.body.setTranslation(localPlayer.position, true)
              }
              updateAnimation(animationData)
              cameraFollowPlayer(camera, localPlayer, CAMERA_OFFSET, orbit, ['x', 'z'])
            }
          } else if (!localPlayer.userData.performing) {
            updateAnimation(animationData)
          }

          if (p2pSession) {
            broadcastPosition.x = localPlayer.position.x
            broadcastPosition.y = localPlayer.position.y
            broadcastPosition.z = localPlayer.position.z
            broadcastRotation.x = localPlayer.rotation.x
            broadcastRotation.y = localPlayer.rotation.y
            broadcastRotation.z = localPlayer.rotation.z
            p2pSendPosition(p2pSession, broadcastPosition, broadcastRotation)
          }
        }
      })

      timelineManager.addAction({
        frequency: 2,
        name: 'remote-players',
        category: 'user-input',
        action: () => {
          remoteModels.forEach((model, peerId) => {
            if (!model.userData.performing) {
              const isMoving = movingPeers.has(peerId)
              const animData: AnimationData = {
                actionName: isMoving ? 'walk' : 'idle',
                player: model,
                delta: getDelta() * 2,
                speed: isMoving ? WALK_ANIM_SPEED : IDLE_ANIM_SPEED,
                backward: false,
                distance: isMoving ? MOVEMENT_SPEED : 0
              }
              updateAnimation(animData)
              movingPeers.delete(peerId)
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
        const remoteModel = await getModel(scene, world, 'stickboy.glb', remoteSettings)
        remapUVsToWorldProjection(remoteModel)
        applyTextureToModel(remoteModel)
        remoteModels.set(peerId, remoteModel)
        peerCount.value = remoteModels.size
      }

      p2pGetPeerIds(session).forEach((peerId) => {
        addRemotePeer(peerId)
      })

      p2pOnPeerJoin(session, (peerId) => {
        addRemotePeer(peerId)
        if (combinedTextureMap.value) {
          const canvas = combinedTextureMap.value.image as HTMLCanvasElement
          p2pSendData(session, P2P_TEXTURE_CHANNEL, { dataUrl: textureToDataUrl(canvas) })
        }
      })

      p2pOnPeerLeave(session, (peerId) => {
        const model = remoteModels.get(peerId)
        if (model) {
          scene.remove(model)
          remoteModels.delete(peerId)
          peerCount.value = remoteModels.size
        }
      })

      p2pOnPlayers(session, (playerState) => {
        const model = remoteModels.get(playerState.id)
        if (!model) return
        const positionChanged =
          model.position.x !== playerState.position.x || model.position.z !== playerState.position.z
        model.position.set(playerState.position.x, playerState.position.y, playerState.position.z)
        model.rotation.set(playerState.rotation.x, playerState.rotation.y, playerState.rotation.z)
        if (positionChanged) {
          movingPeers.add(playerState.id)
        }
      })

      p2pOnAction(session, (peerId, action) => {
        const model = remoteModels.get(peerId)
        if (!model) return
        playRemoteAction(model, action)
      })

      p2pOnData<{ dataUrl: string }>(session, P2P_TEXTURE_CHANNEL, (payload, peerId) => {
        const model = remoteModels.get(peerId)
        if (!model) return
        const texture = new THREE.TextureLoader().load(payload.dataUrl)
        model.traverse((child: THREE.Object3D) => {
          const mesh = child as THREE.Mesh
          if (!mesh.isMesh) return
          const material = mesh.material as THREE.MeshLambertMaterial
          material.map = texture
          material.needsUpdate = true
        })
      })
    }
  })
}

onMounted(async () => {
  registerViewConfig(route.name as string, reactiveConfig, configControls)
  panelsStore.openPanel('config')
  await init()

  watch(
    () => [reactiveConfig.value.useTexture, reactiveConfig.value.transparentModel],
    () => refreshAllModels()
  )

  watch(
    () => [reactiveConfig.value.frontTexture, reactiveConfig.value.backTexture],
    () => {
      rebuildTexture()
    }
  )
})

onUnmounted(() => {
  clearSceneElements()
  clearAllElementProperties()
  unregisterViewConfig(route.name as string)
  destroyControls()
  if (p2pSession) {
    p2pLeave(p2pSession)
    p2pSession = null
  }
})
</script>

<template>
  <canvas ref="canvas"></canvas>
  <ControlsLogger :logs="hudLogs" />

  <Teleport defer to="#config-panel-extra">
    <TextureEditor
      :front-default="stickmanFront as string"
      :back-default="stickmanBack as string"
      :background-image="silhouette as string"
      @update:front="(url) => buildAndApplyTexture(url, reactiveConfig.backTexture || null)"
      @update:back="
        (url) => buildAndApplyTexture(reactiveConfig.frontTexture || (stickmanFront as string), url)
      "
    />
  </Teleport>

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
      :mapping="{
        Wave: 'wave',
        Attack: 'attack',
        Jump: 'jump',
        Talk: 'talk',
        Sit: 'sit',
        Pick: 'pick',
        Death: 'death'
      }"
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
