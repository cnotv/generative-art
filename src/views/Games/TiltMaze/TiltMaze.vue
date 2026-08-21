<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { createTimelineManager } from '@webgamekit/animation'
import {
  createControls,
  lockScreenOrientation,
  unlockScreenOrientation
} from '@webgamekit/controls'
import type { MotionReading } from '@webgamekit/controls'
import type { LoadProgress } from '@webgamekit/threejs'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import { LobbyUIButton, LobbyUIKeyPill } from '@/components/LobbyUI'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'
import { loadGoogleFont, removeGoogleFont } from '@/utils/ui'
import '@/assets/styles/lobby-ui.scss'
import { reportInputSource } from '@/composables/useInputDevice'
import { createReactiveConfig, registerViewConfig, unregisterViewConfig } from '@/stores/viewConfig'
import { useSceneViewStore } from '@/stores/sceneView'
import { createFallCheckAction, createPhysicsSyncAction } from '@/utils/gameTimelineActions'
import { createOcclusionFader } from '@/utils/occlusionFade'
import { resetBall } from './board'
import { getCameraHeight } from './layout'
import { buildLevel, getNextLevel } from './levels'
import { createTiltDriver } from './tiltDriver'
import { commitRecord, loadBestLevel } from './record'
import { createHoleBurst } from './holeBurst'
import type { VictoryBurst } from './holeBurst'
import { applyTiltInversion, findNearestHole, getKeyboardTilt } from './tilt'
import { useFullscreen } from './useFullscreen'
import TiltMazeSensorDialog from './TiltMazeSensorDialog.vue'
import { getSensorGuidance, getSensorPlatform } from './sensorGuidance'
import type { ScreenTilt, TiltMazeOutcome } from './types'
import {
  CAMERA_LEAN_PER_DEGREE,
  FALL_THRESHOLD_Y,
  GRAVITY_STRENGTH,
  GOAL_COLOR,
  TRAP_COLOR,
  CONTROL_MAPPING,
  KEYBOARD_TILT_DEGREES,
  LEVEL_ARROW_COUNT,
  LEVEL_ARROW_DURATION_SECONDS,
  LEVEL_ARROW_SIZE,
  LEVEL_ARROW_STAGGER_SECONDS,
  LEVEL_ARROW_STROKE_WIDTH,
  MAX_TILT_DEGREES,
  SILENT_SENSOR_TIMEOUT_MS,
  TILT_SMOOTHING,
  configControls,
  setupConfig,
  toCssColor
} from './config'

const FONT_KEY = 'tilt-maze-font'
const DARUMADROP_URL = 'https://fonts.googleapis.com/css2?family=Darumadrop+One&display=swap'

const route = useRoute()
const store = useSceneViewStore()

const canvas = ref<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)

const loadingVisible = ref(true)
const loadingStage = ref('Loading…')
const loadingDetail = ref<string | undefined>(undefined)
const handleProgress = (progress: LoadProgress): void => {
  loadingVisible.value = !progress.done
  loadingStage.value = progress.stage
  loadingDetail.value = progress.detail
}

const reactiveConfig = createReactiveConfig({
  tilt: {
    maxDegrees: MAX_TILT_DEGREES,
    smoothing: TILT_SMOOTHING,
    gravityStrength: GRAVITY_STRENGTH,
    inverted: false
  },
  camera: { leanPerDegree: CAMERA_LEAN_PER_DEGREE }
})

const outcome = ref<TiltMazeOutcome>('playing')
const hasStarted = ref(false)
const level = ref(1)
const bestLevel = ref(loadBestLevel())
const isNewRecord = ref(false)

/** Assigned once the scene exists; a decided round drives the next one through it. */
let startNextRound: () => void = () => undefined

/**
 * The chevrons that sweep the way the level just moved. The sweep has to travel in that
 * direction to read as one, so the chevron the stack ends on is the one that lights last.
 */
const levelArrows = computed(() =>
  Array.from({ length: LEVEL_ARROW_COUNT }, (_unused, index) => ({
    position: index,
    style: {
      animationDelay: `${(outcome.value === 'won' ? LEVEL_ARROW_COUNT - 1 - index : index) * LEVEL_ARROW_STAGGER_SECONDS}s`,
      animationDuration: `${LEVEL_ARROW_DURATION_SECONDS}s`
    }
  }))
)
const levelArrowColor = computed(() =>
  toCssColor(outcome.value === 'won' ? GOAL_COLOR : TRAP_COLOR)
)

const { isFullscreen, isFullscreenSupported, toggleFullscreen } = useFullscreen(stage)

const { destroyControls, currentActions, motion } = createControls({
  mapping: CONTROL_MAPPING,
  motionMaxDegrees: MAX_TILT_DEGREES,
  onInput: (_action, _trigger, device) => reportInputSource(device)
})

// Orientation events only ever arrive in a secure context, on every platform and not just iOS,
// and they fail silently when that is missing — so the state is surfaced rather than guessed at.
const isSecureContext = window.isSecureContext

/**
 * Every iOS browser is WebKit underneath, so a report saying "Chrome" still means Safari's
 * engine with Safari's gates. Naming the app makes a remote diagnosis unambiguous.
 */
const browserLabel = ((): string => {
  const agent = navigator.userAgent
  if (/CriOS/.test(agent)) return 'Chrome (iOS/WebKit)'
  if (/FxiOS/.test(agent)) return 'Firefox (iOS/WebKit)'
  if (/iPhone|iPad/.test(agent)) return 'Safari (iOS)'
  return /Chrome/.test(agent) ? 'Chrome' : 'Other'
})()
const sensorPlatform = getSensorPlatform(navigator.userAgent)
const motionPermission = ref<'granted' | 'denied' | 'unsupported' | 'prompt'>(
  motion.isSupported() ? (motion.needsPermission() ? 'prompt' : 'granted') : 'unsupported'
)
const isTilting = ref(false)
const promptCount = ref(0)
const lastReading = ref<MotionReading | null>(null)
const showDiagnostics = ref(false)
const sensorDialogDismissed = ref(false)
const sensorChecked = ref(false)

const sensorGuidance = computed(() =>
  getSensorGuidance({
    isSupported: motion.isSupported(),
    isSecureContext,
    permission: motionPermission.value,
    isReceiving: isTilting.value,
    platform: sensorPlatform
  })
)

// Held back until the sensor has had its chance to report, so a working phone never sees a
// dialog explaining a problem it does not have.
const showSensorDialog = computed(
  () =>
    hasStarted.value &&
    sensorChecked.value &&
    !sensorDialogDismissed.value &&
    sensorGuidance.value.reason !== null
)

const handleSensorRetry = async (): Promise<void> => {
  sensorChecked.value = false
  motionPermission.value = await motion.requestMotionPermission()
  promptCount.value = motion.getPromptCount()
  watchForSilentSensor()
}

/**
 * A granted sensor that then delivers nothing is the failure mode with no error attached, so
 * rather than leave the player tilting a dead board the readout is opened for them.
 */
const watchForSilentSensor = (): void => {
  setTimeout(() => {
    sensorChecked.value = true
  }, SILENT_SENSOR_TIMEOUT_MS)
}

/**
 * This tap buys exactly one activation-consuming call, and the sensor gets it.
 *
 * Entering fullscreen consumes transient activation per the Fullscreen standard, and so does
 * the orientation grant, so a start handler doing both silently starves whichever runs second
 * — on iOS that meant the permission sheet never appeared and the game looked sensor-less.
 * Fullscreen keeps its own button rather than competing for this one.
 */
const handleStart = async (): Promise<void> => {
  hasStarted.value = true
  const permissionAttempt = motion.requestMotionPermission()

  // The guidance timer must not wait on the grant: an unanswered prompt would otherwise leave
  // a blocked sensor with nothing on screen explaining it.
  watchForSilentSensor()
  motionPermission.value = await permissionAttempt
  promptCount.value = motion.getPromptCount()

  // Last, so the gesture is already spent on the thing that needed it.
  await lockScreenOrientation()
}

// Android only grants the orientation lock to a fullscreen document, so entering is the moment
// it becomes available and the attempt at start may well have been refused.
const handleFullscreen = async (): Promise<void> => {
  await toggleFullscreen()
  if (isFullscreen.value) await lockScreenOrientation()
}

/**
 * The lean the player is asking for, from whichever device is actually reporting. Reads the
 * sensor when one is live and falls back to held keys, so a desk and a phone drive the same
 * board through the same value.
 */
const readTargetTilt = (): ScreenTilt => {
  isTilting.value = motion.isReceiving()
  lastReading.value = motion.getReading()
  if (!isTilting.value) {
    return getKeyboardTilt(Object.keys(currentActions), KEYBOARD_TILT_DEGREES)
  }
  const lean = motion.getTilt()
  return applyTiltInversion({ tiltX: lean.x, tiltZ: lean.y }, reactiveConfig.value.tilt.inverted)
}

onMounted(async () => {
  if (!canvas.value) return
  loadGoogleFont(DARUMADROP_URL, FONT_KEY)
  registerViewConfig(route.name as string, reactiveConfig, configControls)

  await store.init(canvas.value, setupConfig, {
    viewPanels: { showConfig: true, showScene: true, showElements: false },
    playMode: true,
    onProgress: handleProgress,
    defineSetup: async ({ scene, camera, world, getDelta, animate }) => {
      let built = buildLevel(scene, world, level.value)
      let cameraHeight = built.cameraHeight
      let victory: VictoryBurst | null = null
      // Walls stand tall enough that a leaning camera puts them in front of the ball; fading
      // whatever blocks the line of sight keeps the ball findable instead of guessed at.
      const occlusion = createOcclusionFader()
      onUnmounted(() => occlusion.dispose())

      // The board is generated once for the screen it started on; a later rotation refits the
      // framing rather than regenerating, which would throw away the run in progress.
      const refitCamera = (): void => {
        cameraHeight = getCameraHeight(built.layout, window.innerWidth, window.innerHeight)
      }

      /**
       * A level is a new board, not a rearranged one. The old one is disposed first so its
       * rigid bodies leave Rapier's world — a mesh removed without its body would keep
       * colliding with the next level's ball from somewhere invisible.
       */
      startNextRound = (): void => {
        victory?.dispose()
        victory = null
        built.board.dispose()
        built = buildLevel(scene, world, level.value)
        cameraHeight = built.cameraHeight
        isNewRecord.value = false
        outcome.value = 'playing'
      }
      window.addEventListener('resize', refitCamera)
      onUnmounted(() => window.removeEventListener('resize', refitCamera))

      const driver = createTiltDriver({
        camera,
        world,
        getTargetTilt: readTargetTilt,
        getSettings: () => ({
          smoothing: reactiveConfig.value.tilt.smoothing,
          gravityStrength: reactiveConfig.value.tilt.gravityStrength,
          cameraLeanPerDegree: reactiveConfig.value.camera.leanPerDegree
        })
      })

      const handleFall = (): void => {
        if (outcome.value !== 'playing') return
        const { ball, holes } = built.board
        const hole = findNearestHole(ball.position.x, ball.position.z, holes)
        const reachedGoal = Boolean(hole?.isGoal)

        outcome.value = reachedGoal ? 'won' : 'trapped'
        level.value = getNextLevel(level.value, outcome.value)
        // Only a level cleared counts. The run no longer ends, so the record is the highest
        // level ever unlocked rather than the level a run happened to die on — and a trap on
        // level one, which moves nowhere, must not read as an achievement.
        isNewRecord.value = reachedGoal && commitRecord(level.value)
        bestLevel.value = loadBestLevel()

        victory?.dispose()
        victory = hole
          ? createHoleBurst(
              scene,
              hole.position,
              reachedGoal ? GOAL_COLOR : TRAP_COLOR,
              reachedGoal ? 'bloom' : 'implode'
            )
          : null
      }

      const timelineManager = createTimelineManager()
      timelineManager.addAction(createPhysicsSyncAction(() => built.board.ball))
      timelineManager.addAction(
        createFallCheckAction(() => built.board.ball, FALL_THRESHOLD_Y, handleFall)
      )

      /**
       * A finished round ends itself, either way, so the game flows without the player having
       * to find a button between rounds. The hole burst doubles as the pause: without waiting
       * for it the next board would appear before the player saw which hole they went down.
       */
      const advanceFinishedRound = (): void => {
        if (!victory) startNextRound()
      }

      animate({
        beforeTimeline: () => {
          // A decided round parks the ball instead of freezing the loop, so the scene
          // keeps rendering behind the result overlay.
          if (outcome.value !== 'playing') {
            driver.park(cameraHeight)
            advanceFinishedRound()
            return
          }
          driver.apply(cameraHeight, built.board.ball)
          occlusion.update(camera, built.board.ball, built.board.walls)
        },
        afterTimeline: () => {
          if (victory && !victory.update(getDelta())) {
            victory.dispose()
            victory = null
          }
          const { ball } = built.board
          if (outcome.value === 'playing' || ball.position.y > FALL_THRESHOLD_Y) return
          resetBall(ball, built.layout)
        },
        timeline: timelineManager
      })
    }
  })
})

onUnmounted(() => {
  removeGoogleFont(FONT_KEY)
  unlockScreenOrientation()
  destroyControls()
  unregisterViewConfig(route.name as string)
  store.cleanup()
})
</script>

<template>
  <div ref="stage" class="tilt-maze">
    <canvas ref="canvas" class="tilt-maze__canvas"></canvas>

    <div v-if="!hasStarted" class="tilt-maze__overlay">
      <div class="tilt-maze__backdrop"></div>
      <div class="tilt-maze__panel lui-slide-in">
        <h1 class="tilt-maze__title">Tilt Maze</h1>
        <p class="tilt-maze__hint">
          Hold the phone flat and reach the green one
          <LobbyUIKeyPill :keyboard="['←', '↑', '→', '↓']" :gamepad="['Stick']" />
        </p>
        <LobbyUIButton variant="cta" size="sm" autofocus @click="handleStart">Start</LobbyUIButton>
      </div>
    </div>

    <!-- The level change has no panel to announce it, so it is read off the direction the
         chevrons travel while the hole burst plays. -->
    <div v-else-if="outcome !== 'playing'" class="tilt-maze__overlay">
      <div class="tilt-maze__arrows" :style="{ color: levelArrowColor }">
        <component
          :is="outcome === 'won' ? ChevronUp : ChevronDown"
          v-for="arrow in levelArrows"
          :key="arrow.position"
          class="tilt-maze__arrow"
          :size="LEVEL_ARROW_SIZE"
          :stroke-width="LEVEL_ARROW_STROKE_WIDTH"
          :style="arrow.style"
        />
        <p v-if="isNewRecord" class="tilt-maze__record">New record</p>
      </div>
    </div>

    <p v-if="hasStarted" class="tilt-maze__level">
      Level {{ level }}<span v-if="bestLevel"> · Best {{ bestLevel }}</span>
    </p>

    <div v-if="hasStarted && outcome === 'playing'" class="tilt-maze__chrome">
      <LobbyUIButton variant="ghost" size="sm" @click="showDiagnostics = !showDiagnostics">
        Sensor
      </LobbyUIButton>
      <LobbyUIButton
        v-if="isFullscreenSupported"
        variant="ghost"
        size="sm"
        @click="handleFullscreen"
      >
        {{ isFullscreen ? 'Exit fullscreen' : 'Fullscreen' }}
      </LobbyUIButton>
    </div>

    <dl v-if="showDiagnostics" class="tilt-maze__diagnostics">
      <div class="tilt-maze__diagnostic">
        <dt>Browser</dt>
        <dd>{{ browserLabel }}</dd>
      </div>
      <div class="tilt-maze__diagnostic">
        <dt>Secure</dt>
        <dd>{{ isSecureContext }}</dd>
      </div>
      <div class="tilt-maze__diagnostic">
        <dt>Permission</dt>
        <dd>{{ motionPermission }}</dd>
      </div>
      <div class="tilt-maze__diagnostic">
        <dt>Prompt asked</dt>
        <dd>{{ promptCount }}×</dd>
      </div>
      <div class="tilt-maze__diagnostic">
        <dt>Events</dt>
        <dd>{{ isTilting }}</dd>
      </div>
      <div class="tilt-maze__diagnostic">
        <dt>Beta</dt>
        <dd>{{ lastReading ? lastReading.beta.toFixed(1) : '—' }}</dd>
      </div>
      <div class="tilt-maze__diagnostic">
        <dt>Gamma</dt>
        <dd>{{ lastReading ? lastReading.gamma.toFixed(1) : '—' }}</dd>
      </div>
    </dl>

    <TiltMazeSensorDialog
      v-if="showSensorDialog"
      :guidance="sensorGuidance"
      @dismiss="sensorDialogDismissed = true"
      @request-permission="handleSensorRetry"
    />

    <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
  </div>
</template>

<style scoped>
/* Overlay text is not content to select: a drag across it during play highlights a sentence
   instead of tilting the board. */
.tilt-maze {
  position: relative;
  user-select: none;
  width: 100%;

  /* The renderer sizes the canvas to the window, so the stage must match the window exactly.
     Dynamic viewport units track the mobile URL bar as it collapses; 100vh is the tall
     variant and would push the bottom of the board off screen. */
  height: 100dvh;
  overflow: hidden;
}

.tilt-maze__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  touch-action: manipulation;
}

.tilt-maze__level {
  position: absolute;
  top: calc(var(--spacing-3) + env(safe-area-inset-top));
  left: calc(var(--spacing-3) + env(safe-area-inset-left));
  z-index: var(--z-overlay);
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}

.tilt-maze__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-overlay);
  pointer-events: none;
}

.tilt-maze__backdrop {
  position: absolute;
  inset: 0;
  background: var(--lui-backdrop-tint);
  backdrop-filter: blur(var(--lui-backdrop-blur));
}

.tilt-maze__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  pointer-events: all;
  text-align: center;
}

.tilt-maze__title {
  font-family: var(--lui-font);
  font-size: var(--lui-text-important);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  margin: 0;
}

/* The stack inherits its colour from the outcome, so the chevrons and the record line read as
   the same event as the hole burst underneath them. The kit's hard offset shadow carries them
   over the board, which is pastel and would otherwise swallow a pastel stroke. */
.tilt-maze__arrows {
  display: flex;
  flex-direction: column;
  align-items: center;
  filter: drop-shadow(var(--lui-border-shadow));
}

/* Each chevron holds once it has arrived rather than fading back out, so the whole stack is
   still on screen when the next board replaces it. */
.tilt-maze__arrow {
  animation-name: tilt-maze-arrow-sweep;
  animation-timing-function: ease-out;
  animation-fill-mode: both;
}

@keyframes tilt-maze-arrow-sweep {
  from {
    opacity: 0;
    transform: scale(0.6);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.tilt-maze__record {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  color: var(--lui-focus-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
}

.tilt-maze__hint {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  margin: 0;
}

/* Bottom-left, not bottom-right: the goal always sits in the corner opposite the spawn, which
   puts it bottom-right, and controls parked on top of it would hide the thing you aim for. */
.tilt-maze__chrome {
  position: absolute;
  bottom: calc(var(--spacing-3) + env(safe-area-inset-bottom));
  left: calc(var(--spacing-3) + env(safe-area-inset-left));
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  z-index: var(--z-overlay);
}

/* A sensor that fails silently is the hardest thing to report from a phone, so the raw values
   are one tap away rather than needing a tethered debugger. */
.tilt-maze__diagnostics {
  position: absolute;

  /* Anchored to the top edge under the button row: a phone's bottom is where the browser
     chrome and the home indicator live, and a clipped last row is the one that matters. */
  top: calc(var(--spacing-8) + env(safe-area-inset-top));
  left: calc(var(--spacing-3) + env(safe-area-inset-left));
  z-index: var(--z-overlay);
  margin: 0;
  display: grid;
  gap: var(--spacing-1);
  font-family: var(--lui-font);
  font-size: var(--lui-text-tiny);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.tilt-maze__diagnostic {
  display: flex;
  gap: var(--spacing-2);
}

.tilt-maze__diagnostic dt {
  opacity: 0.7;
}

.tilt-maze__diagnostic dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
</style>
