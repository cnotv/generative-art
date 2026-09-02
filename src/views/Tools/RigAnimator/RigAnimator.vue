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
import { RIG_ANIMATOR_SETUP_CONFIG, DEFAULT_FPS } from './config'
import { buildRigAnimatorSchema } from './panelSchema'
import { useRigAnimator } from './useRigAnimator'
import { frameCameraOnModel } from './cameraFraming'
import type { RigAnimatorConfig } from './types'

const route = useRoute()
const routeName = route.name as string
const { setViewPanels, clearViewPanels } = useViewPanelsStore()
const { registerSceneElements, clearSceneElements } = useDebugSceneStore()

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
  frame: 0,
  fps: DEFAULT_FPS
})

const rig = useRigAnimator(reactiveConfig)

let cameraReference: THREE.Camera | null = null
let orbitReference: OrbitControls | null = null
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

/** Rebuilds the panel schema from the rig's current bones, keyframes and playback state. */
const refreshSchema = (): void => {
  updateViewSchema(
    routeName,
    buildRigAnimatorSchema(
      rig.boneNames.value,
      rig.keyframeFrames.value,
      rig.needsAutoRig.value,
      rig.isPlaying.value
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
  (name) => rig.selectBone(name)
)
watch(
  () => reactiveConfig.value.boneRotation,
  (rotation) => rig.applyBoneRotation(rotation),
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
}

onMounted(async () => {
  setViewPanels({ showConfig: true })
  registerViewConfig(
    routeName,
    reactiveConfig,
    buildRigAnimatorSchema([], [], false, false),
    undefined,
    {
      autoRig: () => {
        rig.runAutoRig()
        refreshSchema()
      },
      addKeyframe: () => {
        rig.addKeyframe()
        refreshSchema()
      },
      deleteKeyframe: () => {
        rig.deleteKeyframe()
        refreshSchema()
      },
      togglePlayback: () => {
        rig.togglePlayback()
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
  unregisterViewConfig(routeName)
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
