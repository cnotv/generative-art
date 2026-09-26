<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import { getModel } from '@webgamekit/threejs'
import type { LoadProgress } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { useSceneViewStore } from '@/stores/sceneView'
import { createReactiveConfig, registerViewConfig, unregisterViewConfig } from '@/stores/viewConfig'
import {
  createCameraFollowAction,
  createDirectionalLightFollowAction
} from '@/utils/gameTimelineActions'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import { advanceWalk } from './walk'
import {
  CAMERA_OFFSET,
  DEFAULT_WALK_SPEED,
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

onMounted(async () => {
  if (!canvas.value) return
  registerViewConfig(route.name as string, reactiveConfig, configControls)

  await store.init(canvas.value, setupConfig, {
    viewPanels: { showConfig: true, showScene: true, showElements: true },
    onProgress: handleProgress,
    defineSetup: async ({ scene, world, camera, getDelta, animate }) => {
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
