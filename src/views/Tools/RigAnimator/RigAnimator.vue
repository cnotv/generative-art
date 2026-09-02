<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getTools } from '@webgamekit/threejs'
import type { LoadProgress } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import {
  registerViewConfig,
  unregisterViewConfig,
  updateViewSchema,
  createReactiveConfig
} from '@/stores/viewConfig'
import { useViewPanelsStore } from '@/stores/viewPanels'
import { useDebugSceneStore } from '@/stores/debugScene'
import { useTimelinePanelStore } from '@/stores/timelinePanel'
import { RIG_ANIMATOR_SETUP_CONFIG, DEFAULT_FPS, DEFAULT_MODEL_PATH } from './config'
import { buildRigAnimatorSchema } from './panelSchema'
import { useRigAnimator } from './useRigAnimator'
import { frameCameraOnModel } from './cameraFraming'
import { useBoneGizmo } from './useBoneGizmo'
import { buildRigTimelineSource } from './timelineSource'
import type { RigAnimatorConfig } from './types'

const route = useRoute()
const routeName = route.name as string
const { setViewPanels, clearViewPanels } = useViewPanelsStore()
const { registerSceneElements, clearSceneElements } = useDebugSceneStore()
const timelinePanelStore = useTimelinePanelStore()

const canvas = ref<HTMLCanvasElement | null>(null)
const loadingVisible = ref(true)
const loadingStage = ref('Loading…')
const loadingDetail = ref<string | undefined>(undefined)
const handleProgress = (progress: LoadProgress): void => {
  loadingVisible.value = !progress.done
  loadingStage.value = progress.stage
  loadingDetail.value = progress.detail
}

const reactiveConfig = createReactiveConfig<RigAnimatorConfig>({
  model: '',
  poses: '',
  selectedBone: '',
  boneRotation: { x: 0, y: 0, z: 0 },
  bonePosition: { x: 0, y: 0, z: 0 },
  frame: 0,
  fps: DEFAULT_FPS
})

const rig = useRigAnimator(reactiveConfig)

let cameraReference: THREE.Camera | null = null
let orbitReference: OrbitControls | null = null
let gizmo: ReturnType<typeof useBoneGizmo> | null = null
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

const onCanvasClick = (event: MouseEvent): void => {
  if (!canvas.value || !cameraReference) return
  const rect = canvas.value.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, cameraReference)
  rig.pickBoneFromRay(raycaster)
}

/** Rebuilds the panel schema from the rig's current bones, keyframes and auto-rig state. */
const refreshSchema = (): void => {
  updateViewSchema(
    routeName,
    buildRigAnimatorSchema(
      rig.boneNames.value,
      rig.keyframeFrames.value,
      rig.needsAutoRig.value,
      rig.positionRange.value
    )
  )
}

watch(
  () => reactiveConfig.value.model,
  async (url) => {
    await rig.loadModel(url)
    if (rig.model.value && cameraReference) {
      frameCameraOnModel(cameraReference, orbitReference, rig.model.value)
    }
    refreshSchema()
  }
)
watch(
  () => reactiveConfig.value.poses,
  async (url) => {
    await rig.importJson(url)
    refreshSchema()
  }
)
watch(
  () => reactiveConfig.value.selectedBone,
  (name) => {
    rig.selectBone(name)
    if (rig.selectedBone.value) gizmo?.attach(rig.selectedBone.value)
    else gizmo?.detach()
  }
)
watch(
  () => reactiveConfig.value.boneRotation,
  (rotation) => rig.applyBoneRotation(rotation),
  { deep: true }
)
watch(
  () => reactiveConfig.value.bonePosition,
  (position) => rig.applyBonePosition(position),
  { deep: true }
)
watch(
  () => reactiveConfig.value.frame,
  (frame) => {
    // During playback the frame field only displays where tickPlayback already put the
    // mixer; scrubbing it back would fight that same-tick update every frame.
    if (!rig.isPlaying.value) rig.scrubToFrame(frame)
  }
)
// Playback is driven from the Timeline panel's own Pause button rather than a duplicate one
// in this Config panel; isPlaying just mirrors whatever the panel's isPaused says.
watch(
  () => timelinePanelStore.isPaused,
  (paused) => {
    if (paused === !rig.isPlaying.value) return
    rig.togglePlayback()
  }
)

const init = async (): Promise<void> => {
  if (!canvas.value) return
  const { setup, animate, scene, camera, renderer, setActiveCamera } = await getTools({
    canvas: canvas.value,
    onProgress: handleProgress
  })

  rig.setScene(scene)
  cameraReference = camera

  const { orbit } = await setup({
    config: RIG_ANIMATOR_SETUP_CONFIG,
    defineSetup: async () => {
      animate({
        beforeTimeline: () => rig.tickPlayback(),
        timeline: createTimelineManager()
      })
    }
  })
  orbitReference = orbit

  gizmo = useBoneGizmo(
    camera,
    canvas.value,
    (dragging) => {
      if (orbitReference) orbitReference.enabled = !dragging
    },
    (bone) => {
      reactiveConfig.value.bonePosition = {
        x: bone.position.x,
        y: bone.position.y,
        z: bone.position.z
      }
    }
  )
  scene.add(gizmo.helper)

  timelinePanelStore.setPaused(true)
  timelinePanelStore.register(
    buildRigTimelineSource(
      () => rig.keyframeFrames.value,
      () => reactiveConfig.value.frame,
      () => reactiveConfig.value.fps
    )
  )

  registerSceneElements(
    camera,
    scene.children.filter((child) => child !== camera),
    undefined,
    {
      renderer,
      orbit,
      setCamera: (newCamera) => {
        cameraReference = newCamera
        return setActiveCamera(newCamera)
      }
    }
  )

  reactiveConfig.value.model = DEFAULT_MODEL_PATH
}

onMounted(async () => {
  setViewPanels({ showConfig: true })
  registerViewConfig(
    routeName,
    reactiveConfig,
    buildRigAnimatorSchema([], [], false, rig.positionRange.value),
    undefined,
    {
      autoRig: () => {
        rig.runAutoRig()
        refreshSchema()
      },
      resetBone: () => {
        rig.resetSelectedBone()
      },
      addKeyframe: () => {
        rig.addKeyframe()
        refreshSchema()
      },
      deleteKeyframe: () => {
        rig.deleteKeyframe()
        refreshSchema()
      },
      exportGlb: () => {
        rig.exportGlb()
      },
      exportJson: () => {
        rig.exportJson()
      }
    }
  )
  await init()
  canvas.value?.addEventListener('click', onCanvasClick)
})

onUnmounted(() => {
  canvas.value?.removeEventListener('click', onCanvasClick)
  gizmo?.dispose()
  unregisterViewConfig(routeName)
  timelinePanelStore.unregister()
  clearViewPanels()
  clearSceneElements()
})
</script>

<template>
  <canvas ref="canvas"></canvas>
  <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
</style>
