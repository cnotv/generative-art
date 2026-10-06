<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import { createTimelineManager } from '@webgamekit/animation'
import { createControls } from '@webgamekit/controls'
import type { LoadProgress } from '@webgamekit/threejs'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import '@/assets/styles/lobby-ui.scss'
import { loadGoogleFont, removeGoogleFont } from '@/utils/ui'
import { reportInputSource } from '@/composables/useInputDevice'
import { createReactiveConfig, registerViewConfig, unregisterViewConfig } from '@/stores/viewConfig'
import { useSceneViewStore } from '@/stores/sceneView'
import spanishPack from './phrases/es.json'
import {
  FOG_COLOR,
  FOG_FAR,
  FOG_NEAR,
  LIGHT_DIRECTIONAL_POSITION
} from '@/views/Games/RockRunner/config'
import { createDirectionalLightFollowAction } from '@/utils/gameTimelineActions'
import { CONTROL_MAPPING, GATE_POOL_SIZE, RUN_SPEED, configControls, setupConfig } from './config'
import { useWordRun } from './game/useWordRun'
import { createGatePool } from './scene/gatePool'
import { createCourse } from './scene/course'
import { spawnRunner } from './scene/runner'
import WordRunnerStart from './game/WordRunnerStart.vue'
import WordRunnerHud from './game/WordRunnerHud.vue'
import WordRunnerSummary from './game/WordRunnerSummary.vue'
import type { LanguagePack } from './types'

const FONT_KEY = 'word-runner-font'
const LOBBY_UI_FONT = 'https://fonts.googleapis.com/css2?family=Darumadrop+One&display=swap'

const pack: LanguagePack = spanishPack
const route = useRoute()
const store = useSceneViewStore()
const canvas = ref<HTMLCanvasElement | null>(null)

const loadingVisible = ref(true)
const loadingStage = ref('Loading…')
const loadingDetail = ref<string | undefined>(undefined)
const handleProgress = (progress: LoadProgress): void => {
  loadingVisible.value = !progress.done
  loadingStage.value = progress.stage
  loadingDetail.value = progress.detail
}

const reactiveConfig = createReactiveConfig({ run: { speed: RUN_SPEED } })

const run = useWordRun(pack, {
  speed: () => reactiveConfig.value.run.speed
})
const {
  phase,
  phrase,
  ribbon,
  feedback,
  lapLabel,
  isShuffledLap,
  isRetryLap,
  nextGloss,
  sentence,
  summary,
  upcomingLapNote,
  runSeconds,
  bestSeconds,
  isNewBest
} = run

let destroyControls: () => void = () => undefined
const disposers: Array<() => void> = []

onMounted(async () => {
  if (!canvas.value) return
  loadGoogleFont(LOBBY_UI_FONT, FONT_KEY)
  registerViewConfig(route.name as string, reactiveConfig, configControls)

  const controls = createControls({
    mapping: CONTROL_MAPPING,
    pointerTarget: canvas.value,
    onAction: (action) => run.steer(action === 'left' ? -1 : 1),
    onInput: (_action, _trigger, device) => reportInputSource(device)
  })
  destroyControls = controls.destroyControls

  await store.init(canvas.value, setupConfig, {
    viewPanels: { showConfig: true, showScene: true, showElements: false },
    playMode: true,
    onProgress: handleProgress,
    defineSetup: async ({ scene, camera, world, getDelta, animate }) => {
      // Rock Runner's haze, so the course fades into the distance the way its track does.
      scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR)
      const pool = createGatePool(scene, GATE_POOL_SIZE)
      const { runner, footLift } = await spawnRunner(scene, world)
      disposers.push(pool.dispose)
      run.attachScene({
        slots: pool.slots,
        runner,
        runnerFootLift: footLift,
        camera,
        createCourse: (seed) => createCourse(scene, world, seed)
      })

      const sun = scene.children.find((child) => child instanceof THREE.DirectionalLight)
      const timeline = createTimelineManager()
      // The shadow camera covers a patch around its light; it follows the runner down the course.
      timeline.addAction(
        createDirectionalLightFollowAction(
          () => (sun instanceof THREE.DirectionalLight ? sun : null),
          () => runner,
          LIGHT_DIRECTIONAL_POSITION
        )
      )
      animate({ beforeTimeline: () => run.stepRun(getDelta()), timeline })
    }
  })
  // The day cycle would repaint Rock Runner's light and sky a frame later.
  store.setLightTransitionEnabled(false)
})

onUnmounted(() => {
  removeGoogleFont(FONT_KEY)
  destroyControls()
  run.dispose()
  disposers.forEach((dispose) => dispose())
  unregisterViewConfig(route.name as string)
  store.cleanup()
})
</script>

<template>
  <div class="word-runner">
    <canvas ref="canvas" class="word-runner__canvas"></canvas>
    <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
    <WordRunnerHud
      v-if="phase === 'running' || phase === 'recap'"
      :phase="phase"
      :lap-label="lapLabel"
      :is-shuffled-lap="isShuffledLap"
      :is-retry-lap="isRetryLap"
      :ribbon="ribbon"
      :next-gloss="nextGloss"
      :feedback="feedback"
      :sentence="sentence"
      :translation="phrase.translation"
      :upcoming-lap-note="upcomingLapNote"
      :run-seconds="runSeconds"
    />
    <WordRunnerStart
      v-if="phase === 'idle' && !loadingVisible"
      :phrases="pack.phrases"
      :language-name="pack.languageName"
      @start="run.start"
    />
    <WordRunnerSummary
      v-if="phase === 'finished'"
      :phrase="phrase"
      :summary="summary"
      :run-seconds="runSeconds"
      :best-seconds="bestSeconds"
      :is-new-best="isNewBest"
      @restart="run.start(phrase.id)"
      @pick="run.backToStart"
    />
  </div>
</template>

<style scoped>
.word-runner {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.word-runner__canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
