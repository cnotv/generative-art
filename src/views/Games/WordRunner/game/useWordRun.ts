import { computed, ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import {
  BEND_YAW_RATE_THRESHOLD,
  CHUNK_SIZE,
  FEATURE_OFFSET,
  FEEDBACK_SECONDS,
  GATE_SPACING,
  GRAVEL,
  LANE_COUNT,
  LEAD_IN_DISTANCE,
  MAX_FRAME_SECONDS,
  MAX_RETRY_ATTEMPTS,
  RAMP_HOP,
  RECAP_SECONDS,
  ROUTE_EFFECTS,
  STUMBLE_SHAKE,
  STUMBLE_SHAKE_FREQUENCY
} from '../config'
import { buildLapSchedule } from '../sequence/lapSchedule'
import { buildCorrectLanes, buildLapGates, phraseSeed } from '../sequence/gateLayout'
import { createRunState, passGate, summarizeWords } from '../sequence/progress'
import { gateDistances, stepLane } from '../runner/runMotion'
import {
  chooseRouteFeature,
  effectSpeedRatio,
  insideLanesAlong,
  laneOutcome,
  startEffect,
  tickEffect
} from '../runner/routeAdvantage'
import { hideSlot } from '../scene/gatePool'
import { createRunnerDrawer, drawRunFrame, gateKey, markPassedGate } from './drawRun'
import { createLapTrack } from './lapTrack'
import { loadBestTime, saveBestTime } from './bestTimes'
import type {
  ActiveEffect,
  Course,
  Gate,
  GateDeal,
  LanguagePack,
  Phrase,
  RibbonWord,
  RouteFeature,
  RunFeedback,
  RunnerFrame,
  RunPhase,
  RunScene,
  RunSettings,
  RunState,
  TrackPath
} from '../types'

const CENTRE_LANE = Math.floor(LANE_COUNT / 2)

const capitalise = (text: string): string => text.charAt(0).toLocaleUpperCase() + text.slice(1)

/** What the overlays read off a run: the lap, the hint to show, the sentence and the score. */
const createReadouts = (
  phase: Ref<RunPhase>,
  phrase: ShallowRef<Phrase>,
  runState: ShallowRef<RunState>,
  lapGates: ShallowRef<Gate[]>
) => {
  const currentLap = computed(() => runState.value.laps[runState.value.lapIndex])
  const lapCount = computed(() => runState.value.laps.length)
  // During a recap the index already points at the next lap; the label stays on the one
  // just run, and the next lap is announced in the recap itself.
  const isRecap = computed(() => phase.value === 'recap')
  return {
    lapLabel: computed(() => {
      const shownLap = isRecap.value ? runState.value.lapIndex : runState.value.lapIndex + 1
      return `Lap ${Math.min(shownLap, lapCount.value)} / ${lapCount.value}`
    }),
    isShuffledLap: computed(() => !isRecap.value && (currentLap.value?.shuffled ?? false)),
    isRetryLap: computed(() => !isRecap.value && (currentLap.value?.attempt ?? 0) > 0),
    upcomingLapNote: computed(() => {
      const nextLap = currentLap.value
      if (!isRecap.value || !nextLap) return null
      if (nextLap.attempt > 0) return 'Next: the same words again, with hints'
      return nextLap.shuffled ? 'Next: the same words in new lanes' : null
    }),
    nextGloss: computed(() => {
      const gate = lapGates.value[runState.value.gateIndex]
      if (phase.value !== 'running' || !gate || gate.hint !== 'full') return null
      return phrase.value.words[gate.position].gloss
    }),
    sentence: computed(() => capitalise(phrase.value.words.map((word) => word.text).join(' '))),
    summary: computed(() => summarizeWords(runState.value.history, phrase.value.words.length))
  }
}

/**
 * The inside lane of the stretch after each word's gate on a course, the same on every lap
 * because every lap puts word n's gate at the same place.
 */
const insideLanesOnCourse = (path: TrackPath, wordCount: number): Array<number | null> =>
  insideLanesAlong(
    (distance) => path.sampleAt(distance).yaw,
    gateDistances(0, wordCount, LEAD_IN_DISTANCE, GATE_SPACING),
    FEATURE_OFFSET + GRAVEL.length,
    BEND_YAW_RATE_THRESHOLD,
    LANE_COUNT
  )

/**
 * Everything a run of one phrase is dealt from: its gates' seed, its fixed lanes, its laps.
 * A word whose gate opens onto a bend takes the inside lane, so the bend is its advantage.
 */
const prepareRun = (phrase: Phrase, insideLanes: Array<number | null>) => {
  const seed = phraseSeed(phrase.id)
  const deal: GateDeal = { phrase, seed, laneCount: LANE_COUNT, fallbackPool: [] }
  return {
    deal,
    correctLanes: buildCorrectLanes(seed, phrase.words.length, LANE_COUNT, insideLanes),
    runState: createRunState(buildLapSchedule(phrase.words.length, CHUNK_SIZE))
  }
}

/**
 * The phrase being learned: which one, the lanes its words keep, where the lap schedule
 * stands, and the gates of the lap being run.
 */
const createPhraseRun = (pack: LanguagePack) => {
  const phrase = shallowRef<Phrase>(pack.phrases[0])
  const runState = shallowRef<RunState>(createRunState([]))
  const lapGates = shallowRef<Gate[]>([])
  let deal: GateDeal | null = null
  let correctLanes: number[] = []
  let insideLanes: Array<number | null> = []

  /**
   * Deals a fresh run of a phrase. Its course has to exist before its lanes can be laid out,
   * so `layCourse` builds it from the phrase's seed and reports the bends' inside lanes.
   */
  const prepare = (
    phraseId: string,
    layCourse: (seed: number, wordCount: number) => Array<number | null>
  ): void => {
    const picked = pack.phrases.find((candidate) => candidate.id === phraseId) ?? pack.phrases[0]
    insideLanes = layCourse(phraseSeed(picked.id), picked.words.length)
    const prepared = prepareRun(picked, insideLanes)
    phrase.value = picked
    deal = prepared.deal
    correctLanes = prepared.correctLanes
    runState.value = prepared.runState
  }
  /** What each gate's right lane is better for: the inside of its bend, or a ramp or rocks. */
  const featuresOf = (gates: Gate[]): RouteFeature[] =>
    gates.map((gate) =>
      chooseRouteFeature(gate.position, gate.correctLane, insideLanes[gate.position] ?? null)
    )
  const dealLap = (): Gate[] => {
    if (!deal) return []
    const { lapIndex, laps } = runState.value
    lapGates.value = buildLapGates(deal, laps[lapIndex], lapIndex, correctLanes)
    return lapGates.value
  }
  /** Records the lane run through a gate, and says whether that finished the lap. */
  const pass = (gate: Gate, chosenLane: number): boolean => {
    const previousLap = runState.value.lapIndex
    runState.value = passGate(runState.value, gate, chosenLane, MAX_RETRY_ATTEMPTS)
    return runState.value.lapIndex !== previousLap
  }
  return { phrase, runState, lapGates, prepare, featuresOf, dealLap, pass }
}

/** The hop off a ramp: a single arc over its seconds, flat once it has landed. */
const hopHeight = (hopRemaining: number): number =>
  hopRemaining > 0 ? Math.sin(Math.PI * (1 - hopRemaining / RAMP_HOP.seconds)) * RAMP_HOP.height : 0

/** The run clock and the phrase's best time, kept across the laps of one run. */
const createRunScore = () => {
  const runSeconds = ref(0)
  const bestSeconds = ref<number | null>(null)
  const isNewBest = ref(false)
  const reset = (phraseId: string): void => {
    runSeconds.value = 0
    bestSeconds.value = loadBestTime(phraseId)
    isNewBest.value = false
  }
  const settle = (phraseId: string): void => {
    isNewBest.value = bestSeconds.value === null || runSeconds.value < bestSeconds.value
    if (isNewBest.value) saveBestTime(phraseId, runSeconds.value)
  }
  return { runSeconds, bestSeconds, isNewBest, reset, settle }
}

/** The course currently laid out, rebuilt only when a different phrase needs a different one. */
const createCourseHolder = () => {
  let course: Course | null = null
  let courseSeed: number | null = null
  const useFor = (scene: RunScene, seed: number): void => {
    if (seed === courseSeed) return
    course?.dispose()
    course = scene.createCourse(seed)
    courseSeed = seed
  }
  const dispose = (): void => {
    course?.dispose()
    course = null
    courseSeed = null
  }
  /** Lays the course for a phrase and reports the inside lane after each of its gates. */
  const layFor = (scene: RunScene | null, seed: number, wordCount: number) => {
    if (scene) useFor(scene, seed)
    return course ? insideLanesOnCourse(course.path, wordCount) : []
  }
  return { current: () => course, useFor, layFor, dispose }
}

/** The speed change the last route feature left, and the hop off a ramp, both wearing off. */
const createRouteEffects = () => {
  let effect: ActiveEffect | null = null
  let hopRemaining = 0
  const reset = (): void => {
    effect = null
    hopRemaining = 0
  }
  const runOver = (feature: RouteFeature, lane: number, correctLane: number): void => {
    const outcome = laneOutcome(feature, lane, correctLane)
    effect = startEffect(outcome) ?? effect
    if (outcome === 'boost') hopRemaining = RAMP_HOP.seconds
  }
  const tick = (deltaSeconds: number): void => {
    effect = tickEffect(effect, deltaSeconds)
    hopRemaining = Math.max(0, hopRemaining - deltaSeconds)
  }
  const shake = (elapsed: number): number => {
    const share =
      effect?.outcome === 'stumble' ? effect.remaining / ROUTE_EFFECTS.stumble.seconds : 0
    return Math.sin(elapsed * STUMBLE_SHAKE_FREQUENCY) * STUMBLE_SHAKE * share
  }
  return {
    reset,
    runOver,
    tick,
    shake,
    speedRatio: () => effectSpeedRatio(effect),
    hop: () => hopHeight(hopRemaining)
  }
}

/** The pause between laps: counts down, and says so once when it has run out. */
const createRecapTimer = () => {
  let remaining = 0
  return {
    start: (): void => {
      remaining = RECAP_SECONDS
    },
    hasEnded: (deltaSeconds: number): boolean => {
      remaining -= deltaSeconds
      return remaining <= 0
    }
  }
}

/** The word just passed, shown for a moment with its meaning. */
const createFeedback = () => {
  const feedback = ref<RunFeedback | null>(null)
  let remaining = 0
  const show = (word: { text: string; gloss: string }, correct: boolean): void => {
    feedback.value = { text: word.text, gloss: word.gloss, correct }
    remaining = FEEDBACK_SECONDS
  }
  const tick = (deltaSeconds: number): void => {
    remaining = Math.max(0, remaining - deltaSeconds)
    if (remaining === 0 && feedback.value) feedback.value = null
  }
  const clear = (): void => {
    feedback.value = null
  }
  return { feedback, show, tick, clear }
}

/**
 * One run through a phrase: the lap schedule, the gate under each lane, the runner's lane,
 * and the scene kept in step with all of it every frame. Every lap restarts at the start of
 * the phrase's own course, so each word's gate is met at the same place every time.
 */
export const useWordRun = (pack: LanguagePack, settings: RunSettings) => {
  const phase = ref<RunPhase>('idle')
  const learning = createPhraseRun(pack)
  const { phrase, runState, lapGates } = learning
  const ribbon = ref<RibbonWord[]>([])
  const {
    feedback,
    show: showFeedback,
    tick: tickFeedback,
    clear: clearFeedback
  } = createFeedback()
  const route = createRouteEffects()
  const score = createRunScore()
  const courses = createCourseHolder()
  const lap = createLapTrack()
  const recap = createRecapTimer()
  const targetLane = ref(CENTRE_LANE)

  let scene: RunScene | null = null
  let drawRunner: ((frame: RunnerFrame) => void) | null = null
  let elapsed = 0

  const startLap = (): void => {
    if (!courses.current()) return
    const gates = learning.dealLap()
    lap.begin(gates.length, learning.featuresOf(gates))
    ribbon.value = []
    route.reset()
    scene?.slots.forEach(hideSlot)
    phase.value = 'running'
  }

  const start = (phraseId: string): void => {
    learning.prepare(phraseId, (seed, wordCount) => courses.layFor(scene, seed, wordCount))
    targetLane.value = CENTRE_LANE
    clearFeedback()
    score.reset(phrase.value.id)
    startLap()
  }

  const steer = (direction: number): void => {
    if (phase.value !== 'running' && phase.value !== 'recap') return
    targetLane.value = stepLane(targetLane.value, direction, LANE_COUNT)
  }

  /** The verdict on a word, given the moment the runner goes under its gate. */
  const passThrough = (gateIndex: number): void => {
    const gate = lapGates.value[gateIndex]
    const chosenLane = targetLane.value
    const correct = chosenLane === gate.correctLane
    const word = phrase.value.words[gate.position]
    if (scene) markPassedGate(scene.slots, gateKey(lap.lapSerial(), gateIndex), gate, chosenLane)
    showFeedback(word, correct)
    ribbon.value = [...ribbon.value, { text: word.text, correct }]
    if (!learning.pass(gate, chosenLane)) return
    phase.value = 'recap'
    recap.start()
  }

  /** What the lane does to the runner, where its ramp, rocks or gravel actually are. */
  const runOver = (gateIndex: number): void =>
    route.runOver(lap.featureAt(gateIndex), targetLane.value, lapGates.value[gateIndex].correctLane)

  const finishRun = (): void => {
    phase.value = 'finished'
    scene?.slots.forEach(hideSlot)
    score.settle(phrase.value.id)
  }

  const advanceRecap = (deltaSeconds: number): void => {
    if (!recap.hasEnded(deltaSeconds)) return
    if (runState.value.finished) finishRun()
    else startLap()
  }

  const advance = (deltaSeconds: number): void => {
    route.tick(deltaSeconds)
    const crossed = lap.move(settings.speed() * route.speedRatio() * deltaSeconds)
    // Only the laps themselves are timed, so the clock measures the routes taken.
    if (phase.value === 'recap') {
      advanceRecap(deltaSeconds)
      return
    }
    score.runSeconds.value += deltaSeconds
    crossed.gates.forEach(passThrough)
    crossed.features.forEach(runOver)
  }

  /** Advances the run by one frame and redraws everything that moved. */
  const stepRun = (frameSeconds: number): void => {
    const deltaSeconds = Math.min(frameSeconds, MAX_FRAME_SECONDS)
    elapsed += deltaSeconds
    tickFeedback(deltaSeconds)
    const isMoving = phase.value === 'running' || phase.value === 'recap'
    if (isMoving) advance(deltaSeconds)
    const course = courses.current()
    if (!scene || !drawRunner || !course) return
    drawRunFrame(scene.slots, drawRunner, lap.view(course.path, lapGates.value), {
      targetLane: targetLane.value,
      isMoving,
      deltaSeconds,
      shake: route.shake(elapsed),
      hop: route.hop(),
      snapCamera: lap.takeSnap()
    })
  }

  const backToStart = (): void => {
    ribbon.value = []
    clearFeedback()
    targetLane.value = CENTRE_LANE
    lap.clear()
    scene?.slots.forEach(hideSlot)
    phase.value = 'idle'
  }

  /** Takes the scene once it exists, and lays the first phrase's course behind the start screen. */
  const attachScene = (runScene: RunScene): void => {
    scene = runScene
    drawRunner = createRunnerDrawer(runScene)
    courses.useFor(runScene, phraseSeed(pack.phrases[0].id))
  }

  const dispose = (): void => {
    courses.dispose()
    scene = null
  }

  const readouts = createReadouts(phase, phrase, runState, lapGates)

  return {
    phase,
    phrase,
    ribbon,
    feedback,
    runSeconds: score.runSeconds,
    bestSeconds: score.bestSeconds,
    isNewBest: score.isNewBest,
    ...readouts,
    start,
    steer,
    backToStart,
    stepRun,
    attachScene,
    dispose
  }
}
