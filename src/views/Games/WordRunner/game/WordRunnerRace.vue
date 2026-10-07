<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import { createTimelineManager } from '@webgamekit/animation'
import { createControls, isMobile, type ControlsCurrents } from '@webgamekit/controls'
import { steerDirection } from '@/views/Games/RockRunner/game/rockMotion'
import type { LoadProgress } from '@webgamekit/threejs'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import TouchControl from '@/components/TouchControl.vue'
import { reportInputSource } from '@/composables/useInputDevice'
import { createReactiveConfig, registerViewConfig, unregisterViewConfig } from '@/stores/viewConfig'
import { useSceneViewStore } from '@/stores/sceneView'
import { createDirectionalLightFollowAction } from '@/utils/gameTimelineActions'
import {
  FOG_COLOR,
  FOG_FAR,
  FOG_NEAR,
  LIGHT_DIRECTIONAL_POSITION
} from '@/views/Games/RockRunner/config'
import {
  CONTROL_MAPPING,
  GATE_POOL_SIZE,
  DIFFICULTY_SPEEDS,
  TOUCH_LEFT_BUTTON,
  TOUCH_RIGHT_BUTTON,
  TOUCH_BRAKE_BUTTON,
  configControls,
  setupConfig
} from '../config'
import { nextLevelId } from '../levels/languagePacks'
import { createGatePool } from '../scene/gatePool'
import { createCourse } from '../scene/course'
import { createBalls } from '../scene/balls'
import { createFinishLine } from '../scene/finishLine'
import { useWordRun } from './useWordRun'
import { catchUpSteps, createTickClock } from './tickClock'
import WordRunnerHud from './WordRunnerHud.vue'
import WordRunnerSummary from './WordRunnerSummary.vue'
import type { Difficulty, RemoteRival, SteeringMode } from '../types'

const props = defineProps<{
  levelId: string
  raceSerial: number
  solo: boolean
  started: boolean
  canRestart: boolean
  rivals: RemoteRival[]
  steering: SteeringMode
  difficulty: Difficulty
}>()

const emit = defineEmits<{
  ready: []
  progress: [distance: number, lateral: number]
  finish: [seconds: number]
  restart: [levelId: string]
  lobby: []
}>()

const isTouchDevice = isMobile()
const route = useRoute()
const sceneStore = useSceneViewStore()
const canvas = ref<HTMLCanvasElement | null>(null)

const loadingVisible = ref(true)
const loadingStage = ref('Loading…')
const loadingDetail = ref<string | undefined>(undefined)
const handleProgress = (progress: LoadProgress): void => {
  loadingVisible.value = !progress.done
  loadingStage.value = progress.stage
  loadingDetail.value = progress.detail
}

const reactiveConfig = createReactiveConfig({
  run: { speed: DIFFICULTY_SPEEDS[props.difficulty] }
})
// Every race starts at its difficulty's speed; the panel slider tunes it from there.
watch(
  () => props.difficulty,
  (difficulty) => {
    reactiveConfig.value.run.speed = DIFFICULTY_SPEEDS[difficulty]
  }
)

// The keys and buttons held right now, read every frame for free steering.
const heldActions = ref<ControlsCurrents>({})

const run = useWordRun({
  speed: () => reactiveConfig.value.run.speed,
  steering: props.steering,
  steerInput: () => steerDirection(heldActions.value),
  brakeInput: () => 'brake' in heldActions.value,
  solo: () => props.solo,
  rivals: () => props.rivals,
  onProgress: (distance, lateral) => emit('progress', distance, lateral),
  onFinish: (seconds) => emit('finish', seconds)
})
const steerTowards = (action: string): void => {
  if (action === 'left' || action === 'right') run.steer(action === 'left' ? -1 : 1)
}
const { phase, level, report, ribbon, translation, bestSeconds, isNewBest } = run

const nextLevel = computed(() => (level.value ? nextLevelId(level.value.id) : null))
const isRacing = computed(() => phase.value === 'running' || phase.value === 'waiting')

let sceneReady = false
/** Lays the level the room is on out on the course, and says so once it stands ready. */
const startRace = (): void => {
  if (!sceneReady) return
  run.start(props.levelId)
  if (props.started) run.begin()
  emit('ready')
}

watch(() => props.raceSerial, startRace)
watch(
  () => props.started,
  (started) => {
    if (started) run.begin()
  }
)

let destroyControls: () => void = () => undefined
const disposers: Array<() => void> = []

onMounted(async () => {
  if (!canvas.value) return
  registerViewConfig(route.name as string, reactiveConfig, configControls)
  const controls = createControls({
    mapping: CONTROL_MAPPING,
    pointerTarget: canvas.value,
    onAction: steerTowards,
    onInput: (_action, _trigger, device) => reportInputSource(device)
  })
  destroyControls = controls.destroyControls
  heldActions.value = controls.currentActions

  await sceneStore.init(canvas.value, setupConfig, {
    viewPanels: { showConfig: true, showScene: true, showElements: false },
    playMode: true,
    onProgress: handleProgress,
    defineSetup: async ({ scene, camera, world, animate }) => {
      // Rock Runner's haze, so the course fades into the distance the way its track does.
      scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR)
      const pool = createGatePool(scene, GATE_POOL_SIZE)
      const balls = createBalls(scene, props.steering === 'free' ? world : null)
      const finish = createFinishLine(scene)
      disposers.push(pool.dispose, balls.dispose, finish.dispose)
      run.attachScene({
        slots: pool.slots,
        player: balls.player,
        playerBody: balls.playerBody,
        ghosts: balls.ghosts,
        finishLine: finish.finishLine,
        camera,
        createCourse: (seed) => createCourse(scene, world, seed)
      })

      const sun = scene.children.find((child) => child instanceof THREE.DirectionalLight)
      const timeline = createTimelineManager()
      // The shadow camera covers a patch around its light; it follows the ball down the course.
      timeline.addAction(
        createDirectionalLightFollowAction(
          () => (sun instanceof THREE.DirectionalLight ? sun : null),
          () => balls.player,
          LIGHT_DIRECTIONAL_POSITION
        )
      )
      const tickSeconds = createTickClock()
      animate({
        beforeTimeline: () => {
          const seconds = tickSeconds()
          Array.from({ length: catchUpSteps(seconds) }).forEach(() => world.step())
          run.stepRun(seconds)
        },
        timeline
      })
    }
  })
  // The day cycle would repaint Rock Runner's light and sky a frame later.
  sceneStore.setLightTransitionEnabled(false)
  sceneReady = true
  startRace()
})

onUnmounted(() => {
  destroyControls()
  run.dispose()
  disposers.forEach((dispose) => dispose())
  unregisterViewConfig(route.name as string)
  sceneStore.cleanup()
})
</script>

<template>
  <div class="word-runner-race">
    <canvas ref="canvas" class="word-runner-race__canvas"></canvas>
    <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
    <WordRunnerHud
      v-if="isRacing"
      :waiting="phase === 'waiting'"
      :translation="translation"
      :ribbon="ribbon"
    />
    <TouchControl
      v-if="isTouchDevice && phase === 'running'"
      class="word-runner-race__touch word-runner-race__touch--left"
      mode="button"
      :mapping="TOUCH_LEFT_BUTTON"
      :current-actions="heldActions"
      :on-action="steerTowards"
    />
    <TouchControl
      v-if="isTouchDevice && phase === 'running'"
      class="word-runner-race__touch word-runner-race__touch--right"
      mode="button"
      :mapping="TOUCH_RIGHT_BUTTON"
      :current-actions="heldActions"
      :on-action="steerTowards"
    />
    <TouchControl
      v-if="isTouchDevice && phase === 'running'"
      class="word-runner-race__touch word-runner-race__touch--brake"
      mode="button"
      :mapping="TOUCH_BRAKE_BUTTON"
      :current-actions="heldActions"
      :on-action="steerTowards"
    />
    <WordRunnerSummary
      v-if="phase === 'finished' && level && report"
      :level="level"
      :report="report"
      :best-seconds="bestSeconds"
      :is-new-best="isNewBest"
      :has-next-level="nextLevel !== null"
      :can-restart="canRestart"
      @next="nextLevel && emit('restart', nextLevel)"
      @restart="emit('restart', level.id)"
      @pick="emit('lobby')"
    />
  </div>
</template>

<style scoped>
.word-runner-race {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.word-runner-race__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.word-runner-race__touch {
  position: absolute;
  bottom: var(--spacing-6);
  z-index: var(--z-dropdown);
}

.word-runner-race__touch--left {
  left: var(--spacing-6);
}

.word-runner-race__touch--right {
  right: var(--spacing-6);
}

.word-runner-race__touch--brake {
  left: 50%;
  transform: translateX(-50%);
}
</style>
