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
  CAMERA_TARGET,
  CONTROL_MAPPING,
  GATE_POOL_SIZE,
  RUN_SPEED,
  configControls,
  setupConfig
} from './config'
import { useWordRun } from './game/useWordRun'
import { createGatePool } from './scene/gatePool'
import { createTrack } from './scene/track'
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

const reactiveConfig = createReactiveConfig({ run: { speed: RUN_SPEED, speech: true } })

const run = useWordRun(pack, {
  speed: () => reactiveConfig.value.run.speed,
  speechEnabled: () => reactiveConfig.value.run.speech
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
  upcomingLapNote
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

  // Orbit is off but still aims the camera at its target on its first update, so the target
  // is set to the same point the loop looks at, or the first frame frames the origin.
  const config = {
    ...setupConfig,
    orbit: { target: new THREE.Vector3(...CAMERA_TARGET), disabled: true }
  }

  await store.init(canvas.value, config, {
    viewPanels: { showConfig: true, showScene: true, showElements: false },
    playMode: true,
    onProgress: handleProgress,
    defineSetup: async ({ scene, camera, world, getDelta, animate }) => {
      const track = createTrack(scene)
      const pool = createGatePool(scene, GATE_POOL_SIZE)
      const runner = await spawnRunner(scene, world)
      disposers.push(track.dispose, pool.dispose)
      run.attachScene({ slots: pool.slots, runner, camera, scrollTrack: track.scroll })

      animate({
        beforeTimeline: () => run.stepRun(getDelta()),
        timeline: createTimelineManager()
      })
    }
  })
  // The day cycle would repaint the pastel rig a frame later; the signs have to stay readable.
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
