<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useRoute } from 'vue-router'
import { getTools } from '@webgamekit/threejs'
import type { LoadProgress } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
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
import { disposeModel, generateAutoRig, loadModelFile } from '@/views/Tools/RigAnimator/rigModel'
import { frameCameraOnModel } from '@/views/Tools/RigAnimator/cameraFraming'
import { exportModelAsGlb } from '@/views/Tools/RigAnimator/export'
import {
  applyPartScales,
  collectRigBones,
  createPartScales,
  measureRigBones,
  partsInRig
} from './bodyParts'
import { applyFaceFeatures, createFaceSettings, featuresInFace, measureFace } from './faceFeatures'
import {
  DEFAULT_MODEL_PATH,
  EXPORT_FILENAME_SUFFIX,
  FACE_OFFSET_CONTROL,
  FACE_SIZE_CONTROL,
  MODEL_EDITOR_SETUP_CONFIG,
  MODEL_FILE_ACCEPT,
  PART_SCALE_CONTROL
} from './config'
import type {
  FaceFeatureName,
  FaceMeshRig,
  ModelEditorBoneRest,
  ModelEditorConfig,
  ModelEditorPart
} from './types'

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
const availableFeatures = ref<FaceFeatureName[]>([])
const createEditorConfig = (): ModelEditorConfig => ({
  body: createPartScales(),
  face: createFaceSettings()
})
const reactiveConfig = createReactiveConfig(createEditorConfig())

let sceneReference: THREE.Scene | null = null
let cameraReference: THREE.Camera | null = null
let orbitReference: OrbitControls | null = null
let model: THREE.Object3D | null = null
let rigBones: ModelEditorBoneRest[] = []
let faceRig: FaceMeshRig[] = []

/**
 * Only what the loaded model can actually be edited by gets controls: a rig named by another
 * convention shows no body group, and a model with no head bone shows no face group, rather
 * than sliders that move nothing.
 */
const configSchema = computed<ConfigControlsSchema>(() => ({
  resetProportions: { callback: 'resetProportions', label: 'Reset Proportions' },
  downloadModel: { callback: 'downloadModel', label: 'Download Model' },
  ...(availableParts.value.length > 0 && {
    body: Object.fromEntries(
      availableParts.value.map((part) => [
        part.name,
        { length: PART_SCALE_CONTROL, size: PART_SCALE_CONTROL }
      ])
    )
  }),
  ...(availableFeatures.value.length > 0 && {
    face: Object.fromEntries(
      availableFeatures.value.map((feature) => [
        feature,
        { size: FACE_SIZE_CONTROL, height: FACE_OFFSET_CONTROL, depth: FACE_OFFSET_CONTROL }
      ])
    )
  })
}))

const resetProportions = (): void => {
  reactiveConfig.value = createEditorConfig()
}

/** The loaded file's own name without its extension, from a path or a tagged blob URL. */
const modelFileStem = (url: string): string =>
  (url.split('#').pop() ?? url)
    .split('/')
    .pop()
    ?.replace(/\.[^.]+$/, '') || 'model'

const downloadModel = async (): Promise<void> => {
  if (model)
    await exportModelAsGlb(model, `${modelFileStem(modelUrl.value)}${EXPORT_FILENAME_SUFFIX}`)
}

/**
 * Give the model a humanoid skeleton when it arrives without one, so a plain uploaded mesh gets
 * the same sliders as a rigged character, then measure its bones and its face once, at rest.
 */
const prepareModel = (loaded: THREE.Object3D): void => {
  if (collectRigBones(loaded).length === 0) generateAutoRig(loaded)
  const bones = collectRigBones(loaded)
  rigBones = measureRigBones(bones)
  availableParts.value = partsInRig(bones.map((bone) => bone.name))
  faceRig = measureFace(loaded, bones)
  availableFeatures.value = featuresInFace(faceRig)
}

const loadModel = async (url: string): Promise<void> => {
  if (!sceneReference || !url) return
  if (model) {
    sceneReference.remove(model)
    disposeModel(model)
  }
  model = null
  loadingVisible.value = true
  loadingStage.value = 'Loading model'
  try {
    const loaded = await loadModelFile(url)
    sceneReference.add(loaded)
    model = loaded
    loaded.updateMatrixWorld(true)
    loadingStage.value = 'Measuring rig'
    // Rigging and measuring run in one synchronous stretch, so the overlay gets a frame to show
    // before a large mesh holds the page.
    await new Promise(requestAnimationFrame)
    prepareModel(loaded)
    resetProportions()
    if (cameraReference) frameCameraOnModel(cameraReference, orbitReference, loaded)
  } finally {
    loadingVisible.value = false
  }
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
  () => reactiveConfig.value.body,
  (body) => {
    if (rigBones.length > 0) applyPartScales(rigBones, body)
  },
  { deep: true }
)
watch(
  () => reactiveConfig.value.face,
  (face) => {
    if (faceRig.length > 0) applyFaceFeatures(faceRig, face)
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
    resetProportions,
    downloadModel
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
