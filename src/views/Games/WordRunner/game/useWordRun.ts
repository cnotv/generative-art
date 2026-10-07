import { computed, ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import { seededRandomValues } from '@webgamekit/threejs'
import {
  BEND_YAW_RATE_THRESHOLD,
  BOT_ACCURACY,
  FEATURE_OFFSET,
  FEEDBACK_SECONDS,
  FINISH_RUN_OUT,
  GATE_SPACING,
  GRAVEL,
  LANE_COUNT,
  LEAD_IN_DISTANCE,
  MAX_FRAME_SECONDS,
  ROUTE_EFFECTS,
  STUMBLE_SHAKE,
  STUMBLE_SHAKE_FREQUENCY
} from '../config'
import { LANGUAGE_PACKS, findLevel, nextLevelId } from '../levels/languagePacks'
import { levelHints, levelWords, sentenceIndices, sentenceText } from '../sequence/levelText'
import { buildCorrectLanes, buildRunGates, levelSeed } from '../sequence/gateLayout'
import { createRunState, passGate } from '../sequence/progress'
import { crossedGateIndices, gateDistances, stepLane } from '../runner/runMotion'
import { chooseRouteFeature, insideLanesAlong, laneOutcome } from '../runner/routeAdvantage'
import { planBotLanes } from '../runner/bot'
import { applyOutcome, createRacer, hopHeight, stepRacer } from '../runner/racer'
import { hideSlot } from '../scene/gatePool'
import { placeFinishLine } from '../scene/finishLine'
import { createRaceDrawer, drawRaceFrame, gateKey, markPassedGate } from './drawRun'
import { loadBestTime, saveBestTime } from './bestTimes'
import { saveLevelCleared } from './levelProgress'
import { buildRunReport, raceResult } from './runReport'
import type {
  Course,
  Gate,
  GateResult,
  GateView,
  Level,
  LevelWord,
  RaceFrame,
  Racer,
  RibbonWord,
  RouteFeature,
  RunFeedback,
  RunPhase,
  RunReport,
  RunScene,
  RunSettings,
  RunState,
  TrackPath
} from '../types'

const CENTRE_LANE = Math.floor(LANE_COUNT / 2)

/** Everything one attempt at a level is dealt from, laid out along its course. */
type LevelRun = {
  level: Level
  words: LevelWord[]
  gates: Gate[]
  features: RouteFeature[]
  gateDistances: number[]
  finishDistance: number
  botLanes: number[]
  sentenceOfWord: number[]
}

/**
 * Deals a level onto its course. The lanes come from the level's seed, so they are the same
 * on every attempt and the route can be learned; a word whose gate opens onto a bend takes
 * the inside lane, so the bend is its advantage. Only the bot's choices change per attempt.
 */
const prepareLevelRun = (level: Level, path: TrackPath, attempt: number): LevelRun => {
  const words = levelWords(level)
  const seed = levelSeed(level.id)
  const distances = gateDistances(0, words.length, LEAD_IN_DISTANCE, GATE_SPACING)
  const insideLanes = insideLanesAlong(
    (distance) => path.sampleAt(distance).yaw,
    // The bend is measured across the gravel in front of the word and as far again past it.
    distances.map((distance) => distance + FEATURE_OFFSET - GRAVEL.length / 2),
    GRAVEL.length * 2,
    BEND_YAW_RATE_THRESHOLD,
    LANE_COUNT
  )
  const correctLanes = buildCorrectLanes(seed, words.length, LANE_COUNT, insideLanes)
  const gates = buildRunGates(
    { words, seed, laneCount: LANE_COUNT, fallbackPool: [] },
    levelHints(level),
    correctLanes
  )
  const botRandomValues = seededRandomValues((seed + attempt + 1) >>> 0, gates.length * 2)
  return {
    level,
    words,
    gates,
    features: gates.map((gate) =>
      chooseRouteFeature(gate.position, gate.correctLane, insideLanes[gate.position] ?? null)
    ),
    gateDistances: distances,
    finishDistance: (distances[distances.length - 1] ?? LEAD_IN_DISTANCE) + FINISH_RUN_OUT,
    botLanes: planBotLanes(gates, BOT_ACCURACY[level.cefr], botRandomValues, LANE_COUNT),
    sentenceOfWord: sentenceIndices(level)
  }
}

/** What the HUD reads off a run: the sentence being built, its English, the hint, the race. */
const createReadouts = (
  phase: Ref<RunPhase>,
  levelRun: ShallowRef<LevelRun | null>,
  runState: ShallowRef<RunState>
) => {
  const sentenceIndex = computed(() => {
    const run = levelRun.value
    if (!run) return 0
    return run.sentenceOfWord[runState.value.gateIndex] ?? run.level.sentences.length - 1
  })
  return {
    sentenceIndex,
    sentenceCount: computed(() => levelRun.value?.level.sentences.length ?? 0),
    translation: computed(
      () => levelRun.value?.level.sentences[sentenceIndex.value]?.translation ?? ''
    ),
    ribbon: computed<RibbonWord[]>(() => {
      const run = levelRun.value
      if (!run) return []
      return runState.value.results
        .filter((result) => run.sentenceOfWord[result.position] === sentenceIndex.value)
        .map((result) => ({
          text: sentenceText([run.words[result.position]]),
          correct: result.correct
        }))
    }),
    nextGloss: computed(() => {
      const run = levelRun.value
      const gate = run?.gates[runState.value.gateIndex]
      if (phase.value !== 'running' || !run || !gate || gate.hint !== 'full') return null
      return run.words[gate.position].gloss
    })
  }
}

/** The race clock and the level's best time. */
const createRunScore = () => {
  const runSeconds = ref(0)
  const bestSeconds = ref<number | null>(null)
  const isNewBest = ref(false)
  const reset = (levelId: string): void => {
    runSeconds.value = 0
    bestSeconds.value = loadBestTime(levelId)
    isNewBest.value = false
  }
  const settle = (levelId: string): void => {
    isNewBest.value = bestSeconds.value === null || runSeconds.value < bestSeconds.value
    if (isNewBest.value) saveBestTime(levelId, runSeconds.value)
  }
  return { runSeconds, bestSeconds, isNewBest, reset, settle }
}

/** The course laid out now: restarted for another attempt, rebuilt only for another level. */
const createCourseHolder = () => {
  let course: Course | null = null
  let courseSeed: number | null = null
  const useFor = (scene: RunScene, seed: number): Course => {
    if (course && seed === courseSeed) course.restart()
    else {
      course?.dispose()
      course = scene.createCourse(seed)
      courseSeed = seed
    }
    return course
  }
  const dispose = (): void => {
    course?.dispose()
    course = null
    courseSeed = null
  }
  return { current: () => course, useFor, dispose }
}

/** The word just passed, shown for a moment with its meaning. */
const createFeedback = () => {
  const feedback = ref<RunFeedback | null>(null)
  let remaining = 0
  const show = (word: LevelWord, correct: boolean): void => {
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

/** The lane the bot holds: the one it planned for the next gate it has not reached. */
const botLaneAt = (run: LevelRun, distance: number): number => {
  const nextGate = run.gateDistances.findIndex((gateDistance) => gateDistance >= distance)
  return run.botLanes[nextGate] ?? run.botLanes[run.botLanes.length - 1] ?? CENTRE_LANE
}

type BallsStep = {
  player: Racer
  bot: Racer
  playerLane: number
  baseSpeed: number
  deltaSeconds: number
  elapsedSeconds: number
}

/**
 * What the lane a ball took through a gate does to it. The ramp, rocks or gravel lie just in
 * front of the word, so the lane that is judged is the one the word was taken in, never the
 * one the player has already turned towards for the next word.
 */
const runThroughGates = (
  run: LevelRun,
  racer: Racer,
  fromDistance: number,
  laneAt: (gateIndex: number) => number
): Racer =>
  crossedGateIndices(fromDistance, racer.distance, run.gateDistances).reduce(
    (current, gateIndex) =>
      applyOutcome(
        current,
        laneOutcome(run.features[gateIndex], laneAt(gateIndex), run.gates[gateIndex].correctLane)
      ),
    racer
  )

/**
 * Rolls both balls on by one frame, and applies the route feature of every gate each one went
 * through in its lane. Also says which gates the player's ball went through, for their words.
 */
const stepBalls = (
  run: LevelRun,
  { player, bot, playerLane, baseSpeed, deltaSeconds, elapsedSeconds }: BallsStep
): { player: Racer; bot: Racer; crossedGates: number[] } => {
  const step = { baseSpeed, deltaSeconds, elapsedSeconds, finishDistance: run.finishDistance }
  const movedPlayer = stepRacer(player, step)
  const movedBot = stepRacer(bot, step)
  return {
    player: runThroughGates(run, movedPlayer, player.distance, () => playerLane),
    bot: runThroughGates(run, movedBot, bot.distance, (gateIndex) => run.botLanes[gateIndex]),
    crossedGates: crossedGateIndices(player.distance, movedPlayer.distance, run.gateDistances)
  }
}

/** The sideways shake of a stumble, strongest when it starts and fading as it wears off. */
const stumbleShake = (racer: Racer, elapsed: number): number => {
  const share =
    racer.effect?.outcome === 'stumble' ? racer.effect.remaining / ROUTE_EFFECTS.stumble.seconds : 0
  return Math.sin(elapsed * STUMBLE_SHAKE_FREQUENCY) * STUMBLE_SHAKE * share
}

/** The report on a finished race, recording the level as cleared when the player won it. */
const settleRace = (
  run: LevelRun,
  results: GateResult[],
  seconds: number,
  bot: Racer
): RunReport => {
  const race = raceResult({
    playerSeconds: seconds,
    botFinishSeconds: bot.finishSeconds,
    botDistance: bot.distance,
    finishDistance: run.finishDistance
  })
  const found = findLevel(run.level.id)
  if (race.won && found) saveLevelCleared(found.pack.language, found.levelIndex)
  return buildRunReport({
    gates: run.gates,
    results,
    words: run.words,
    seconds,
    race,
    hasNextLevel: nextLevelId(run.level.id) !== null
  })
}

type DrawState = {
  run: LevelRun | null
  path: TrackPath
  player: Racer
  bot: Racer
  playerLane: number
  runSerial: number
  deltaSeconds: number
  elapsed: number
  snapCamera: boolean
}

/** Where the gates and the two balls stand this frame. With no level running, no gates show. */
const framesFor = (state: DrawState): { view: GateView; frame: RaceFrame } => ({
  view: {
    path: state.path,
    gates: state.run?.gates ?? [],
    features: state.run?.features ?? [],
    distances: state.run?.gateDistances ?? [],
    distance: state.player.distance,
    runSerial: state.runSerial
  },
  frame: {
    path: state.path,
    player: {
      distance: state.player.distance,
      lane: state.playerLane,
      hop: hopHeight(state.player)
    },
    bot: {
      distance: state.bot.distance,
      lane: state.run ? botLaneAt(state.run, state.bot.distance) : CENTRE_LANE,
      hop: hopHeight(state.bot)
    },
    deltaSeconds: state.deltaSeconds,
    shake: stumbleShake(state.player, state.elapsed),
    snapCamera: state.snapCamera
  }
})

/**
 * One race through a level against the bot: a gate per word of the text, the player's lane
 * through each, both balls slowed or sped up by the lanes they take, and the scene kept in
 * step every frame. The first ball over the finish line wins, and winning opens the next level.
 */
export const useWordRun = (settings: RunSettings) => {
  const phase = ref<RunPhase>('idle')
  const levelRun = shallowRef<LevelRun | null>(null)
  const runState = shallowRef<RunState>(createRunState())
  const report = shallowRef<RunReport | null>(null)
  const targetLane = ref(CENTRE_LANE)
  const standing = ref(0)
  const {
    feedback,
    show: showFeedback,
    tick: tickFeedback,
    clear: clearFeedback
  } = createFeedback()
  const score = createRunScore()
  const courses = createCourseHolder()

  let scene: RunScene | null = null
  let drawRace: ReturnType<typeof createRaceDrawer> | null = null
  let player: Racer = createRacer()
  let bot: Racer = createRacer()
  let attempt = 0
  let runSerial = 0
  let snapCamera = true
  let elapsed = 0

  const start = (levelId: string): void => {
    const found = findLevel(levelId)
    if (!found || !scene) return
    const course = courses.useFor(scene, levelSeed(found.level.id))
    attempt += 1
    runSerial += 1
    const run = prepareLevelRun(found.level, course.path, attempt)
    levelRun.value = run
    runState.value = createRunState()
    report.value = null
    player = createRacer()
    bot = createRacer()
    targetLane.value = CENTRE_LANE
    standing.value = 0
    snapCamera = true
    clearFeedback()
    score.reset(run.level.id)
    scene.slots.forEach(hideSlot)
    placeFinishLine(scene.finishLine, course.path.sampleAt(run.finishDistance))
    phase.value = 'running'
  }

  const steer = (direction: number): void => {
    if (phase.value !== 'running') return
    targetLane.value = stepLane(targetLane.value, direction, LANE_COUNT)
  }

  /** The verdict on a word, given the moment the player's ball goes through its gate. */
  const passThrough = (run: LevelRun, gateIndex: number): void => {
    const gate = run.gates[gateIndex]
    const chosenLane = targetLane.value
    if (scene) markPassedGate(scene.slots, gateKey(runSerial, gateIndex), gate, chosenLane)
    showFeedback(run.words[gate.position], chosenLane === gate.correctLane)
    runState.value = passGate(runState.value, gate, chosenLane)
  }

  const finishRun = (run: LevelRun): void => {
    report.value = settleRace(run, runState.value.results, score.runSeconds.value, bot)
    score.settle(run.level.id)
    phase.value = 'finished'
  }

  /** Moves both balls on, judges every gate the player went through, and settles the finish. */
  const advance = (run: LevelRun, deltaSeconds: number): void => {
    score.runSeconds.value += deltaSeconds
    const stepped = stepBalls(run, {
      player,
      bot,
      playerLane: targetLane.value,
      baseSpeed: settings.speed(),
      deltaSeconds,
      elapsedSeconds: score.runSeconds.value
    })
    // A gate stands before its route feature, so the word is judged in the lane it was run in.
    stepped.crossedGates.forEach((gateIndex) => passThrough(run, gateIndex))
    player = stepped.player
    bot = stepped.bot
    courses
      .current()
      ?.advance(Math.max(player.distance, bot.distance), Math.min(player.distance, bot.distance))
    standing.value = player.distance - bot.distance
    if (player.finishSeconds !== null) finishRun(run)
  }

  /** Advances the race by one frame and redraws everything that moved. */
  const stepRun = (frameSeconds: number): void => {
    const deltaSeconds = Math.min(frameSeconds, MAX_FRAME_SECONDS)
    elapsed += deltaSeconds
    tickFeedback(deltaSeconds)
    const run = levelRun.value
    if (phase.value === 'running' && run) advance(run, deltaSeconds)
    const course = courses.current()
    if (!scene || !drawRace || !course) return
    const { view, frame } = framesFor({
      run: phase.value === 'idle' ? null : run,
      path: course.path,
      player,
      bot,
      playerLane: targetLane.value,
      runSerial,
      deltaSeconds,
      elapsed,
      snapCamera
    })
    drawRaceFrame(scene.slots, drawRace, view, frame)
    snapCamera = false
  }

  const backToStart = (): void => {
    clearFeedback()
    report.value = null
    phase.value = 'idle'
  }

  /** Takes the scene once it exists, and lays the first level's course behind the start screen. */
  const attachScene = (runScene: RunScene): void => {
    scene = runScene
    drawRace = createRaceDrawer(runScene)
    const firstLevel = LANGUAGE_PACKS[0]?.levels[0]
    if (firstLevel) courses.useFor(runScene, levelSeed(firstLevel.id))
  }

  const dispose = (): void => {
    courses.dispose()
    scene = null
  }

  return {
    phase,
    level: computed(() => levelRun.value?.level ?? null),
    report,
    feedback,
    standing,
    runSeconds: score.runSeconds,
    bestSeconds: score.bestSeconds,
    isNewBest: score.isNewBest,
    ...createReadouts(phase, levelRun, runState),
    start,
    steer,
    backToStart,
    stepRun,
    attachScene,
    dispose
  }
}
