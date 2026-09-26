<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import {
  colorModel,
  getGroundHeight,
  getModel,
  instanceMatrixModel,
  loadGLTF
} from '@webgamekit/threejs'
import type { LoadProgress } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { useSceneViewStore } from '@/stores/sceneView'
import { createReactiveConfig, registerViewConfig, unregisterViewConfig } from '@/stores/viewConfig'
import {
  createCameraFollowAction,
  createDirectionalLightFollowAction
} from '@/utils/gameTimelineActions'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import { plantBand } from './planting'
import { advanceWalk } from './walk'
import {
  CAMERA_OFFSET,
  DEFAULT_WALK_SPEED,
  FOREST_COLORS,
  FOREST_MODEL,
  FOREST_TRUNK_PARTS,
  GROUND_RELIEF,
  TREE_BANDS,
  UNDERGROWTH_BANDS,
  SUN_OFFSET,
  WALK_ANIMATION,
  WALK_END_Z,
  WALK_START_Z,
  characterOptions,
  configControls,
  setupConfig
} from './config'

const canvas = ref<HTMLCanvasElement | null>(null)
const route = useRoute()
const store = useSceneViewStore()

const loadingVisible = ref(true)
const loadingStage = ref('Loading…')
const loadingDetail = ref<string | undefined>(undefined)
const handleProgress = (progress: LoadProgress): void => {
  loadingVisible.value = !progress.done
  loadingStage.value = progress.stage
  loadingDetail.value = progress.detail
}

const reactiveConfig = createReactiveConfig({ walkSpeed: DEFAULT_WALK_SPEED })

/**
 * The tree, recoloured, shadowed and ready to be instanced. Loaded once per set rather than
 * shared, since a set that drops parts must not drop them from the other set's template too.
 * @returns A fresh instance of the tree model
 */
const loadForestModel = async (): Promise<THREE.Group> => {
  const { model } = await loadGLTF(FOREST_MODEL, { castShadow: true, receiveShadow: true })
  colorModel(model, FOREST_COLORS)
  return model
}

/**
 * Drop named meshes from a model, and rest what is left on the model's own origin.
 *
 * Taking the trunk out leaves the canopy hanging at the height the trunk used to hold it, and
 * `instanceMatrixModel` works in the root's frame, so lowering the root cancels itself out. The
 * parts are what has to come down.
 * @param model The model to take parts out of
 * @param names The mesh names to remove
 * @returns The same model, without those parts and sitting on its own origin
 */
/**
 * The ground's height at a spot, which is what everything standing on it is placed by.
 * @param x World X
 * @param z World Z
 * @returns Height above the ground's declared level
 */
const groundHeightAt = (x: number, z: number): number => getGroundHeight(x, z, GROUND_RELIEF)

const stripParts = (model: THREE.Group, names: string[]): THREE.Group => {
  names.forEach((name) => model.getObjectByName(name)?.removeFromParent())
  const base = new THREE.Box3().setFromObject(model).min.y
  model.children.forEach((child) => {
    child.position.y -= base
  })
  return model
}

onMounted(async () => {
  if (!canvas.value) return
  registerViewConfig(route.name as string, reactiveConfig, configControls)

  await store.init(canvas.value, setupConfig, {
    viewPanels: { showConfig: true, showScene: true, showElements: true },
    onProgress: handleProgress,
    defineSetup: async ({ scene, world, camera, getDelta, animate }) => {
      handleProgress({ stage: 'Forest', detail: FOREST_MODEL, done: false })
      // One group, so the Elements panel lists the forest as the one thing it is rather than as
      // a row per mesh the tree model happens to be built from.
      const forest = new THREE.Group()
      forest.name = 'forest'
      const treeModel = await loadForestModel()
      instanceMatrixModel(
        treeModel,
        forest,
        TREE_BANDS.flatMap((band) => plantBand(band, groundHeightAt))
      )
      const bushModel = stripParts(await loadForestModel(), FOREST_TRUNK_PARTS)
      instanceMatrixModel(
        bushModel,
        forest,
        UNDERGROWTH_BANDS.flatMap((band) => plantBand(band, groundHeightAt))
      )
      scene.add(forest)

      const walker = await getModel(scene, world, 'character2.fbx', {
        ...characterOptions,
        onProgress: handleProgress
      })
      const mixer = walker.userData.mixer as THREE.AnimationMixer
      const actions = walker.userData.actions as Record<string, THREE.AnimationAction>
      actions[WALK_ANIMATION].play()

      const sun = scene.getObjectByName('directional-light') as THREE.DirectionalLight | undefined

      const timeline = createTimelineManager()
      timeline.addAction({
        name: 'walk',
        category: 'animation',
        start: 0,
        action: () => {
          const delta = getDelta()
          mixer.update(delta)
          walker.position.z = advanceWalk(
            walker.position.z,
            reactiveConfig.value.walkSpeed * delta,
            WALK_START_Z,
            WALK_END_Z
          )
          // Follows the ground rather than the level it was declared at, or she wades through
          // every rise and hangs over every dip.
          walker.position.y =
            characterOptions.position![1] + groundHeightAt(walker.position.x, walker.position.z)
        }
      })
      // After the walk action, so both read the position this frame rather than the last one.
      timeline.addAction(
        createDirectionalLightFollowAction(
          () => sun ?? null,
          () => walker,
          SUN_OFFSET
        )
      )
      timeline.addAction(createCameraFollowAction(camera, () => walker, CAMERA_OFFSET))

      animate({ timeline })
    }
  })

  // The day cycle would otherwise overwrite every light and the background a frame later,
  // and the low backlit sun this scene is built around is the whole look.
  store.setLightTransitionEnabled(false)
})

onUnmounted(() => {
  store.cleanup()
  unregisterViewConfig(route.name as string)
})
</script>

<template>
  <canvas ref="canvas"></canvas>
  <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
</template>
