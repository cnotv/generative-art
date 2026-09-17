<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useRoute } from 'vue-router'
import { getTools } from '@webgamekit/threejs'
import type { LoadProgress } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { rigFindSkinnedMesh } from '@webgamekit/rig'
import { Upload } from 'lucide-vue-next'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import IconButton from '@/components/IconButton.vue'
import {
  createReactiveConfig,
  registerViewConfig,
  unregisterViewConfig,
  updateViewSchema
} from '@/stores/viewConfig'
import type { ConfigControlsSchema } from '@/stores/viewConfig'
import { useViewPanelsStore } from '@/stores/viewPanels'
import {
  disposeModel,
  loadModelFile,
  resolveHierarchyBones
} from '@/views/Tools/RigAnimator/rigModel'
import { frameCameraOnModel } from '@/views/Tools/RigAnimator/cameraFraming'
import { applyPartScales, createPartScales, measureRigBones, partsInRig } from './bodyParts'
import {
  DEFAULT_MODEL_PATH,
  MODEL_EDITOR_SETUP_CONFIG,
  MODEL_FILE_ACCEPT,
  PART_SCALE_CONTROL
} from './config'
import type { ModelEditorBoneRest, ModelEditorPart } from './types'

const route = useRoute()
const { setViewPanels, clearViewPanels } = useViewPanelsStore()

const canvas = ref<HTMLCanvasElement | null>(null)
const modelFileInput = ref<HTMLInputElement | null>(null)
const loadingVisible = ref(true)
const loadingStage = ref('Loading…')
const loadingDetail = ref<string | undefined>(undefined)
const handleProgress = (progress: LoadProgress): void => {
  loadingVisible.value = !progress.done
  loadingStage.value = progress.stage
  loadingDetail.value = progress.detail
}

const modelUrl = ref(DEFAULT_MODEL_PATH)
const availableParts = ref<ModelEditorPart[]>([])
const reactiveConfig = createReactiveConfig(createPartScales())

let sceneReference: THREE.Scene | null = null
let cameraReference: THREE.Camera | null = null
let orbitReference: OrbitControls | null = null
let model: THREE.Object3D | null = null
let rigBones: ModelEditorBoneRest[] = []

/**
 * Only the regions the loaded rig actually has bones for get controls, so a model rigged to
 * another convention shows an empty panel rather than sliders that move nothing.
 */
const configSchema = computed<ConfigControlsSchema>(() => ({
  resetParts: { callback: 'resetParts', label: 'Reset Proportions' },
  ...Object.fromEntries(
    availableParts.value.map((part) => [
      part.name,
      { length: PART_SCALE_CONTROL, size: PART_SCALE_CONTROL }
    ])
  )
}))

const resetParts = (): void => {
  reactiveConfig.value = createPartScales()
}

const loadModel = async (url: string): Promise<void> => {
  if (!sceneReference || !url) return
  if (model) {
    sceneReference.remove(model)
    disposeModel(model)
  }

  model = await loadModelFile(url)
  sceneReference.add(model)
  // Marker-free measuring still reads local offsets, but the camera framing below reads world
  // bounds, which are stale until the freshly added model has had its matrices updated once.
  model.updateMatrixWorld(true)

  const skinnedMesh = rigFindSkinnedMesh(model)
  const bones = skinnedMesh ? resolveHierarchyBones(skinnedMesh.skeleton.bones) : []
  rigBones = measureRigBones(bones)
  availableParts.value = partsInRig(bones.map((bone) => bone.name))
  resetParts()

  if (cameraReference) frameCameraOnModel(cameraReference, orbitReference, model)
}

const handleModelFileChange = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  // Tags the real filename onto the blob URL as a fragment: `loadModelFile` picks its loader by
  // extension, and a bare `URL.createObjectURL` result carries none at all.
  if (file) modelUrl.value = `${URL.createObjectURL(file)}#${file.name}`
}

watch(modelUrl, (url) => loadModel(url))
watch(configSchema, (schema) => updateViewSchema(route.name as string, schema))
watch(
  reactiveConfig,
  (parts) => {
    if (rigBones.length > 0) applyPartScales(rigBones, parts)
  },
  { deep: true }
)

const init = async (): Promise<void> => {
  if (!canvas.value) return
  const { setup, animate, scene, camera } = await getTools({
    canvas: canvas.value,
    onProgress: handleProgress
  })
  sceneReference = scene
  cameraReference = camera

  const { orbit } = await setup({
    config: MODEL_EDITOR_SETUP_CONFIG,
    defineSetup: async () => {
      animate({ timeline: createTimelineManager() })
    }
  })
  orbitReference = orbit

  await loadModel(modelUrl.value)
}

onMounted(async () => {
  setViewPanels({ showConfig: true })
  registerViewConfig(route.name as string, reactiveConfig, configSchema.value, undefined, {
    resetParts
  })
  await init()
})

onUnmounted(() => {
  clearViewPanels()
  unregisterViewConfig(route.name as string)
  if (model) disposeModel(model)
})
</script>

<template>
  <canvas ref="canvas"></canvas>
  <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
  <div class="model-editor-controls">
    <input
      ref="modelFileInput"
      type="file"
      :accept="MODEL_FILE_ACCEPT"
      class="model-editor-controls__hidden-input"
      @change="handleModelFileChange"
    />
    <IconButton size="sm" variant="outline" title="Upload Model" @click="modelFileInput?.click()">
      <Upload />
    </IconButton>
  </div>
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}

.model-editor-controls {
  position: fixed;
  top: calc(var(--nav-height) + var(--spacing-3));
  left: var(--spacing-3);
  z-index: var(--z-overlay);
  display: flex;
  gap: var(--spacing-2);
}

.model-editor-controls__hidden-input {
  display: none;
}
</style>
