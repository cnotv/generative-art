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
import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { createTiltDriver, type TiltDriver } from './tiltDriver'
import { commitRecord, loadBestLevel } from './record'
import { createHoleBurst } from './holeBurst'
import type { VictoryBurst } from './holeBurst'
import {
  applyTiltInversion,
  findNearestHole,
  getActiveLean,
  getFramedCameraHeight,
  getKeyboardTilt
} from './tilt'
import { useFullscreen } from './useFullscreen'
import TiltMazeSensorDialog from './TiltMazeSensorDialog.vue'
import { createBoardDecorations } from './decorations'
import { getSensorGuidance, getSensorPlatform } from './sensorGuidance'
import type { ScreenTilt, TiltMazeOutcome } from './types'
import {
  CAMERA_LEAN_MARGIN,
  CAMERA_LEAN_PER_DEGREE,
  FALL_THRESHOLD_Y,
  GRAVITY_STRENGTH,
  GOAL_COLOR,
  TRAP_COLOR,
  CONTROL_MAPPING,
  KEYBOARD_TILT_DEGREES,
  LEVEL_VERDICT_DURATION_SECONDS,
  LEVEL_WIPE_DURATION_SECONDS,
  LEVEL_WIPE_STAGE_COLOR,
  LEVEL_WIPE_STAGE_DELAY_RATIO,
  LEVEL_VERDICT_INK,
  LEVEL_COVER_SECONDS,
  START_TILT_DEGREES,
  MILLISECONDS_PER_SECOND,
  LEVEL_VERDICT_STAGGER_SECONDS,
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
  diagnostics: { showSensor: false },
  camera: { leanPerDegree: CAMERA_LEAN_PER_DEGREE }
})

const outcome = ref<TiltMazeOutcome>('playing')
const hasStarted = ref(false)
/** Covers the board and pulls back to reveal it, so a round opens the way a level change closes. */
const isRevealing = ref(false)
let revealTimer: ReturnType<typeof setTimeout> | undefined

const playStartWipe = (): void => {
  isRevealing.value = true
  clearTimeout(revealTimer)
  revealTimer = setTimeout(() => {
    isRevealing.value = false
  }, LEVEL_WIPE_DURATION_SECONDS * MILLISECONDS_PER_SECOND)
}

onUnmounted(() => clearTimeout(revealTimer))
const level = ref(1)
const bestLevel = ref(loadBestLevel())
const isNewRecord = ref(false)

/** Assigned once the scene exists; a decided round drives the next one through it. */
let startNextRound: () => void = () => undefined

/** What the round did to the level, said outright rather than implied by a direction. */
const levelVerdict = computed(() => (outcome.value === 'won' ? 'Level up' : 'Level down'))

/** Each letter lands in turn, so the phrase assembles itself rather than simply appearing. */
const verdictLetters = computed(() =>
  [...levelVerdict.value].map((character, index) => ({
    key: `${index}-${character}`,
    character: character === ' ' ? '\u00a0' : character,
    style: {
      animationDelay: `${index * LEVEL_VERDICT_STAGGER_SECONDS}s`,
      animationDuration: `${LEVEL_VERDICT_DURATION_SECONDS}s`
    }
  }))
)

const levelVerdictColor = computed(() =>
  toCssColor(outcome.value === 'won' ? GOAL_COLOR : TRAP_COLOR)
)

/** The disc the verdict is read against, the same whichever way the level went. */
const stageColor = toCssColor(LEVEL_WIPE_STAGE_COLOR)
const verdictInk = toCssColor(LEVEL_VERDICT_INK)

/** Won rises, lost drops — the phrase travels the way the level just moved. */
const verdictDirection = computed(() => (outcome.value === 'won' ? 'up' : 'down'))

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

/**
 * Whether this is a device that leans rather than a desk that types.
 *
 * Keyed on the platform, not on whether the sensor is currently reporting: iOS cannot report
 * until permission is granted, and permission needs a tap. Reading the live sensor here told an
 * iPhone it was a desktop — arrow keys it does not have, and an instruction to tilt that could
 * not work, with no hint that a tap was the way in.
 */
const isHandheld = sensorPlatform !== 'desktop'
const motionPermission = ref<'granted' | 'denied' | 'unsupported' | 'prompt'>(
  motion.isSupported() ? (motion.needsPermission() ? 'prompt' : 'granted') : 'unsupported'
)
const isTilting = ref(false)
const promptCount = ref(0)
const lastReading = ref<MotionReading | null>(null)
// Lives in the Config panel rather than on the canvas: it is a debugging readout, and game
// chrome is for things the player needs mid-round.
const showDiagnostics = computed(() => reactiveConfig.value.diagnostics.showSensor)
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
  if (hasStarted.value) return
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
/**
 * Begin on the first real lean, from either device. The title card has no button any more, so
 * the gesture that starts the game is the same one that plays it.
 * @param tilt The lean being asked for this frame
 */
const startOnFirstTilt = (tilt: ScreenTilt): void => {
  if (hasStarted.value) return
  // A phone is never level in a hand, so its lean would start the round before the player has
  // read the title. There, a tap is the deliberate signal — and on iOS it is also the gesture
  // the motion permission grant requires.
  if (isHandheld) return
  if (Math.hypot(tilt.tiltX, tilt.tiltZ) < START_TILT_DEGREES) return
  void handleStart()
}

/**
 * Record what the round did: the outcome, the level it moves to, and whether that beat the
 * record.
 *
 * Only a level cleared counts. The run no longer ends, so the record is the highest level ever
 * unlocked rather than the level a run happened to die on — and a trap on level one, which
 * moves nowhere, must not read as an achievement.
 * @param reachedGoal Whether the ball fell into the goal rather than a trap
 */
// The swap happens under a covered screen: the discs get their full run before the next board
// replaces this one, so the transition never cuts to a board mid-build.
const cover = { seconds: 0 }

/**
 * Whether the cover has been up long enough to swap the board behind it.
 * @param deltaSeconds Seconds since the last frame
 * @returns True on the frame the cover completes, then false until the next round
 */
const isCoverComplete = (deltaSeconds: number): boolean => {
  cover.seconds += deltaSeconds
  if (cover.seconds < LEVEL_COVER_SECONDS) return false
  cover.seconds = 0
  return true
}

const settleRound = (reachedGoal: boolean): void => {
  outcome.value = reachedGoal ? 'won' : 'trapped'
  level.value = getNextLevel(level.value, outcome.value)
  isNewRecord.value = reachedGoal && commitRecord(level.value)
  bestLevel.value = loadBestLevel()
}

const readTargetTilt = (): ScreenTilt => {
  isTilting.value = motion.isReceiving()
  lastReading.value = motion.getReading()
  if (!isTilting.value) {
    // Released actions keep their entry in currentActions, so the keys have to be filtered by
    // value. Reading them all reports a permanent hard-left lean that nobody asked for.
    const held = Object.keys(currentActions).filter((action) => currentActions[action])
    return getKeyboardTilt(held, KEYBOARD_TILT_DEGREES)
  }
  const lean = motion.getTilt()
  return applyTiltInversion({ tiltX: lean.x, tiltZ: lean.y }, reactiveConfig.value.tilt.inverted)
}

/** The lean this frame, which also decides whether an unstarted round begins. */
/**
 * The tilt driver for a scene, reading its tuning live from the panel.
 * @param camera The scene camera it moves
 * @param world The physics world whose gravity it leans
 * @returns The per-frame driver
 */
const createDriverFor = (camera: THREE.Camera, world: RAPIER.World): TiltDriver =>
  createTiltDriver({
    camera,
    world,
    getTargetTilt: readAndMaybeStart,
    getSettings: () => ({
      smoothing: reactiveConfig.value.tilt.smoothing,
      gravityStrength: reactiveConfig.value.tilt.gravityStrength,
      cameraLeanPerDegree: getActiveLean(isTilting.value, reactiveConfig.value.camera.leanPerDegree)
    })
  })

const readAndMaybeStart = (): ScreenTilt => {
  const tilt = readTargetTilt()
  startOnFirstTilt(tilt)
  return tilt
}

/**
 * Everything the view needs before the scene exists: the cover that opens the game, the font the
 * overlays are set in, and the panel registration.
 */
const prepareView = (): void => {
  // Opens the game the way a level change closes: the cover pulls back off the board once,
  // here, and never again for a start.
  playStartWipe()
  loadGoogleFont(DARUMADROP_URL, FONT_KEY)
  registerViewConfig(route.name as string, reactiveConfig, configControls)
}

onMounted(async () => {
  if (!canvas.value) return
  prepareView()

  await store.init(canvas.value, setupConfig, {
    viewPanels: { showConfig: true, showScene: true, showElements: false },
    playMode: true,
    onProgress: handleProgress,
    defineSetup: async ({ scene, camera, world, getDelta, animate }) => {
      let built = buildLevel(scene, world, level.value)
      let cameraHeight = built.cameraHeight
      let victory: VictoryBurst | null = null

      const decorations = createBoardDecorations(scene, built, level.value)
      let decorationSeconds = 0
      onUnmounted(() => decorations.dispose())
      // Walls stand tall enough that a leaning camera puts them in front of the ball; fading
      // whatever blocks the line of sight keeps the ball findable instead of guessed at.
      const occlusion = createOcclusionFader()
      onUnmounted(() => occlusion.dispose())

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
        decorations.rebuild(built, level.value)
        isNewRecord.value = false
        outcome.value = 'playing'
        // The cover is still on screen at this point; closing it is what shows the new board.
        playStartWipe()
      }
      // The board is generated once for the screen it started on; a later rotation refits the
      // framing rather than regenerating, which would throw away the run in progress.
      const refitCamera = (): void => {
        cameraHeight = getCameraHeight(built.layout, window.innerWidth, window.innerHeight)
      }
      window.addEventListener('resize', refitCamera)
      onUnmounted(() => window.removeEventListener('resize', refitCamera))

      const driver = createDriverFor(camera, world)

      const handleFall = (): void => {
        if (outcome.value !== 'playing') return
        const { ball, holes } = built.board
        const hole = findNearestHole(ball.position.x, ball.position.z, holes)
        const reachedGoal = Boolean(hole?.isGoal)

        settleRound(reachedGoal)

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
       * A finished round ends itself, either way, so the game flows without the player having to
       * find a button between rounds.
       *
       * The cover runs from the moment the round is decided, alongside the hole burst rather
       * than after it. Waiting for the burst first made the two queue up — the discs finished
       * covering the screen and then sat there while a burst nobody could see played out
       * underneath them.
       */
      const advanceFinishedRound = (): void => {
        if (!isCoverComplete(getDelta())) return
        startNextRound()
      }

      /**
       * One frame of everything that is not the physics step: the goal beacon, the camera, and
       * the occlusion fade that keeps the ball findable behind a wall.
       */
      const stepFrame = (): void => {
        // Keeps orbiting through a decided round, so the goal is already marked on the board
        // waiting behind the result overlay.
        decorationSeconds += getDelta()
        decorations.update(decorationSeconds)

        const height = getFramedCameraHeight(isTilting.value, cameraHeight, CAMERA_LEAN_MARGIN)

        // Nothing moves until the round begins. A phone is always leaning, so without this the
        // ball rolls around behind the title card and the game looks started when it is not.
        // The lean is still read, because reading it is what notices the round should start —
        // parking alone would freeze the board and the start together.
        if (!hasStarted.value) {
          readAndMaybeStart()
          driver.park(height)
          return
        }

        // A decided round parks the ball instead of freezing the loop, so the scene
        // keeps rendering behind the result overlay.
        if (outcome.value !== 'playing') {
          driver.park(height)
          advanceFinishedRound()
          return
        }

        driver.apply(height, built.board.ball)
        occlusion.update(camera, built.board.ball, built.board.walls)
      }

      animate({
        beforeTimeline: stepFrame,
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
      <div class="tilt-maze__backdrop" :style="{ backgroundColor: stageColor }"></div>
      <div
        class="tilt-maze__panel tilt-maze__panel--tappable lui-slide-in"
        :style="{ color: verdictInk }"
        @click="handleStart"
      >
        <h1 class="tilt-maze__title">Tilt Maze</h1>
        <p class="tilt-maze__hint">
          {{ isHandheld ? 'Tap to begin' : 'Tilt to begin' }} — reach the green one
        </p>
        <!-- Below the line rather than trailing it: the keys are the answer to "how", so they
             read as their own row instead of punctuation on the end of a sentence. -->
        <LobbyUIKeyPill v-if="!isHandheld" :keyboard="['←', '↑', '→', '↓']" :gamepad="['Stick']" />
      </div>
    </div>

    <!-- The level change has no panel to announce it, so the verdict says it outright while the
         hole burst plays. The verdict lives inside the yellow disc rather than beside it, so the
         circle carries the text with it as it moves. -->
    <div v-else-if="outcome !== 'playing'" class="tilt-maze__overlay">
      <div
        class="tilt-maze__wipe"
        :style="{
          backgroundColor: levelVerdictColor,
          animationDuration: `${LEVEL_WIPE_DURATION_SECONDS}s`
        }"
      ></div>
      <div
        class="tilt-maze__wipe tilt-maze__wipe--stage"
        :style="{
          backgroundColor: stageColor,
          animationDuration: `${LEVEL_WIPE_DURATION_SECONDS}s`,
          animationDelay: `${LEVEL_WIPE_DURATION_SECONDS * LEVEL_WIPE_STAGE_DELAY_RATIO}s`
        }"
      >
        <div class="tilt-maze__verdict" :class="`tilt-maze__verdict--${verdictDirection}`">
          <p class="tilt-maze__verdict-line">
            <span
              v-for="letter in verdictLetters"
              :key="letter.key"
              class="tilt-maze__verdict-letter"
              :style="letter.style"
              >{{ letter.character }}</span
            >
          </p>
          <p v-if="isNewRecord" class="tilt-maze__record">New record</p>
        </div>
      </div>
    </div>

    <!-- Starting closes the same circle instead of opening it, so a round begins by pulling the
         cover back off the board. -->
    <div v-else-if="isRevealing" class="tilt-maze__overlay">
      <div
        class="tilt-maze__wipe tilt-maze__wipe--reveal"
        :style="{
          backgroundColor: stageColor,
          animationDuration: `${LEVEL_WIPE_DURATION_SECONDS}s`
        }"
      ></div>
    </div>

    <p v-if="hasStarted && bestLevel" class="tilt-maze__level">Best {{ bestLevel }}</p>

    <div v-if="hasStarted && outcome === 'playing'" class="tilt-maze__chrome">
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

/* The card takes the tap that starts a round on a phone. Scoped to the card rather than the
   whole overlay: a full-screen hit area swallowed every click on the app chrome behind it and
   started the game whenever anything else was pressed. */
.tilt-maze__panel--tappable {
  cursor: pointer;
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

/* Two solid irises opening from the centre, the second trailing the first: the outcome colour
   sweeps the board, then the stage the verdict is read against opens inside it. Both hold at
   full cover, so the next board is built behind them rather than in view. */
.tilt-maze__wipe {
  position: absolute;
  inset: 0;
  animation-name: tilt-maze-wipe;
  animation-timing-function: ease-out;
  animation-fill-mode: both;
}

/* 120%, not 100%: the percentage is measured against a reference circle, so anything less
   leaves the corners of a wide screen showing and the board flashes through the handover. */
@keyframes tilt-maze-wipe {
  from {
    clip-path: circle(0% at 50% 50%);
  }

  to {
    clip-path: circle(120% at 50% 50%);
  }
}

/* Holds the verdict, so the circle carries the text rather than the text sitting beside it. */
.tilt-maze__wipe--stage {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

/* The reverse: the cover closes onto the middle, taking the verdict with it and leaving the
   new board behind. It starts where the opening ended, so the two are one continuous cover. */
.tilt-maze__wipe--reveal {
  animation-name: tilt-maze-wipe-reveal;
  animation-timing-function: ease-in;
}

@keyframes tilt-maze-wipe-reveal {
  from {
    clip-path: circle(120% at 50% 50%);
  }

  to {
    clip-path: circle(0% at 50% 50%);
  }
}

/* The same pastel yellow the verdict lands on, so opening the game and changing level are
   visibly the same surface. Solid rather than a tint: the board behind it is about to be
   replaced by the first level anyway. */
.tilt-maze__backdrop {
  position: absolute;
  inset: 0;
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

/* Inherits its colour from the outcome, so the verdict and the record line read as the same
   event as the hole burst underneath them. The kit's hard offset shadow carries them over the
   board, which is pastel and would otherwise swallow a pastel stroke. */
.tilt-maze__verdict {
  display: flex;
  flex-direction: column;
  align-items: center;
  filter: drop-shadow(var(--lui-border-shadow));
}

.tilt-maze__verdict-line {
  display: flex;
  justify-content: center;
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-important);
  text-align: center;
  text-transform: uppercase;

  /* White on the pastel yellow, carried by the kit's outline — the same pairing the title uses
     on this surface, and lighter than inking it in the background plum. */
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

/* Each letter holds once it has landed rather than fading back out, so the whole phrase is
   still on screen when the next board replaces it. */
.tilt-maze__verdict-letter {
  display: inline-block;
  animation-name: tilt-maze-verdict-drop;
  animation-timing-function: cubic-bezier(0.2, 1.6, 0.35, 1);
  animation-fill-mode: both;
}

/* Won rises into place, lost falls into it: the phrase travels the way the level just moved. */
.tilt-maze__verdict--up .tilt-maze__verdict-letter {
  --tilt-maze-verdict-from: 0.7em;
}

.tilt-maze__verdict--down .tilt-maze__verdict-letter {
  --tilt-maze-verdict-from: -0.7em;
}

@keyframes tilt-maze-verdict-drop {
  0% {
    opacity: 0;
    transform: translateY(var(--tilt-maze-verdict-from)) scale(0.6) rotate(-8deg);
  }

  60% {
    opacity: 1;
    transform: translateY(0) scale(1.15) rotate(3deg);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1) rotate(0deg);
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
