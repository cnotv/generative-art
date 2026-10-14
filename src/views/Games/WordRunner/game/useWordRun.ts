import { computed, ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import { seededRandomValues } from '@webgamekit/threejs'
import {
  BEND_YAW_RATE_THRESHOLD,
  BOT_ACCURACY,
  FEATURE_OFFSET,
  FINISH_RUN_OUT,
  GATE_SPACING,
  GRAVEL,
  CENTRE_LANE,
  LANE_COUNT,
  LEAD_IN_DISTANCE,
  MAX_FRAME_SECONDS,
  PROGRESS_INTERVAL_SECONDS,
  ROUTE_EFFECTS,
  STUMBLE_SHAKE,
  STUMBLE_SHAKE_FREQUENCY
} from '../config'
import { LANGUAGE_PACKS, findLevel } from '../levels/languagePacks'
import { levelHints, levelWords, sentenceIndices, sentenceText } from '../sequence/levelText'
import { buildCorrectLanes, buildRunGates, levelSeed } from '../sequence/gateLayout'
import { createRunState, passGate } from '../sequence/progress'
import { crossedGateIndices, gateDistances, stepLane } from '../runner/runMotion'
import { chooseRouteFeature, insideLanesAlong, laneOutcome } from '../runner/routeAdvantage'
import { planBotLanes } from '../runner/bot'
import { applyImpulse, applyOutcome, createRacer, hopHeight, impulseCharge } from '../runner/racer'
import { createRivals } from './raceRivals'
import { createPlayerMotion } from './playerMotion'
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
  LaneOutcome,
  Level,
  LevelWord,
  RaceFrame,
  Racer,
  RivalFrame,
  RibbonWord,
  RouteFeature,
  RunPhase,
  RunReport,
  RunScene,
  RunSettings,
  RunState,
  Rival,
  TrackPath
} from '../types'

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
 * @param level The level to run.
 * @param path The course's track.
 * @param attempt Which attempt this is, to vary the bot's choices.
 * @returns The level's words, gates, lanes, route features and the bot's plan.
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

/**
 * What the HUD reads off a run: the sentence being built, and its English.
 * @param levelRun The level being run.
 * @param runState The gates passed so far.
 * @returns The translation of the current sentence and the ribbon of words built.
 */
const createReadouts = (levelRun: ShallowRef<LevelRun | null>, runState: ShallowRef<RunState>) => {
  const sentenceIndex = computed(() => {
    const run = levelRun.value
    if (!run) return 0
    return run.sentenceOfWord[runState.value.gateIndex] ?? run.level.sentences.length - 1
  })
  return {
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
    })
  }
}

/**
 * The race clock and the level's best time, the fastest race won on it.
 * @returns The run time, whether it is a new best, and functions to reset and settle it.
 */
const createRunScore = () => {
  const runSeconds = ref(0)
  const bestSeconds = ref<number | null>(null)
  const isNewBest = ref(false)
  const reset = (levelId: string): void => {
    runSeconds.value = 0
    bestSeconds.value = loadBestTime(levelId)
    isNewBest.value = false
  }
  // A lost race never sets a best time, however fast it was.
  const settle = (levelId: string, won: boolean): void => {
    isNewBest.value = won && (bestSeconds.value === null || runSeconds.value < bestSeconds.value)
    if (isNewBest.value) saveBestTime(levelId, runSeconds.value)
  }
  return { runSeconds, isNewBest, reset, settle }
}

/**
 * The course laid out now: restarted for another attempt, rebuilt only for another level.
 * @returns The current course, a function to lay one out for a seed, and dispose.
 */
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

/**
 * The lane the bot holds: the one it planned for the next gate it has not reached.
 * @param run The level being run.
 * @param distance The bot's distance along the track.
 * @returns The lane it holds.
 */
const botLaneAt = (run: LevelRun, distance: number): number => {
  const nextGate = run.gateDistances.findIndex((gateDistance) => gateDistance >= distance)
  return run.botLanes[nextGate] ?? run.botLanes[run.botLanes.length - 1] ?? CENTRE_LANE
}

/**
 * What the lane a ball took through a gate does to it. The ramp, rocks or gravel lie just in
 * front of the word, so the lane that is judged is the one the word was taken in, never the
 * one the player has already turned towards for the next word.
 * @param run The level being run.
 * @param racer The racer after moving.
 * @param fromDistance Where the racer was before moving.
 * @param laneAt The lane the racer took at a gate.
 * @param onOutcome Called with each lane's outcome.
 * @returns The racer with every crossed gate's outcome applied.
 */
const runThroughGates = (
  run: LevelRun,
  racer: Racer,
  fromDistance: number,
  laneAt: (gateIndex: number) => number,
  onOutcome: (outcome: LaneOutcome) => void = () => undefined
): Racer =>
  crossedGateIndices(fromDistance, racer.distance, run.gateDistances).reduce(
    (current, gateIndex) => {
      const outcome = laneOutcome(
        run.features[gateIndex],
        laneAt(gateIndex),
        run.gates[gateIndex].correctLane
      )
      onOutcome(outcome)
      return applyOutcome(current, outcome)
    },
    racer
  )

/**
 * The sideways shake of a stumble, strongest when it starts and fading as it wears off.
 * @param racer The player's racer.
 * @param elapsed Seconds since the run began, to drive the shake.
 * @returns The sideways offset of the shake.
 */
const stumbleShake = (racer: Racer, elapsed: number): number => {
  const share =
    racer.effect?.outcome === 'stumble' ? racer.effect.remaining / ROUTE_EFFECTS.stumble.seconds : 0
  return Math.sin(elapsed * STUMBLE_SHAKE_FREQUENCY) * STUMBLE_SHAKE * share
}

/**
 * The report on a finished race, recording the level as cleared when the player won it.
 * @param run The level just run.
 * @param results The verdict on each gate.
 * @param seconds The player's time.
 * @param rivals The rivals' standings.
 * @returns The end-of-race report.
 */
const settleRace = (
  run: LevelRun,
  results: GateResult[],
  seconds: number,
  rivals: Rival[]
): RunReport => {
  const race = raceResult({ playerSeconds: seconds, finishDistance: run.finishDistance, rivals })
  const found = findLevel(run.level.id)
  if (race.won && found) saveLevelCleared(found.pack.language, found.levelIndex)
  return buildRunReport({ results, words: run.words, seconds, race })
}

type DrawState = {
  run: LevelRun | null
  path: TrackPath
  player: Racer
  rivals: RivalFrame[]
  playerLateral: number
  playerOnPhysics: boolean
  runSerial: number
  deltaSeconds: number
  elapsed: number
  snapCamera: boolean
}

/**
 * Where the gates and the balls stand this frame. With no level running, no gates show.
 * @param state The course, level run and every ball's state.
 * @returns The gate view and the race frame to draw.
 */
const framesFor = (state: DrawState): { view: GateView; frame: RaceFrame } => ({
  view: {
    path: state.path,
    gates: state.run?.gates ?? [],
    features: state.run?.features ?? [],
    distances: state.run?.gateDistances ?? [],
    distance: state.player.distance,
    runSerial: state.runSerial,
    deltaSeconds: state.deltaSeconds
  },
  frame: {
    path: state.path,
    player: {
      distance: state.player.distance,
      lateral: state.playerLateral,
      hop: hopHeight(state.player)
    },
    playerOnPhysics: state.playerOnPhysics,
    rivals: state.run ? state.rivals : [],
    deltaSeconds: state.deltaSeconds,
    shake: stumbleShake(state.player, state.elapsed),
    snapCamera: state.snapCamera
  }
})

/**
 * Calls back with the ball's place on the course at most once per interval.
 * @param report Sends the ball's distance and lane.
 * @returns A per-frame step that reports when the interval has passed.
 */
const createProgressThrottle = (report: (distance: number, lane: number) => void) => {
  let sinceLast = PROGRESS_INTERVAL_SECONDS
  return (deltaSeconds: number, distance: number, lane: number): void => {
    sinceLast += deltaSeconds
    if (sinceLast < PROGRESS_INTERVAL_SECONDS) return
    sinceLast = 0
    report(distance, lane)
  }
}

/**
 * The player's say in a race: changing lane while it runs, and the start signal that lets the
 * ball roll once the whole room has loaded the course.
 * @param phase The run phase.
 * @param targetLane The lane the player steers to.
 * @param steering Lane steering or free steering.
 * @returns begin, to start a waiting race, and steer, to change lane.
 */
const createSteering = (
  phase: Ref<RunPhase>,
  targetLane: Ref<number>,
  steering: RunSettings['steering']
) => ({
  begin: (): void => {
    if (phase.value === 'waiting') phase.value = 'running'
  },
  // Free steering is held, not stepped: it reads the player's input every frame instead.
  steer: (direction: number): void => {
    if (phase.value !== 'running' || steering !== 'lanes') return
    targetLane.value = stepLane(targetLane.value, direction, LANE_COUNT)
  }
})

/**
 * The bot, run through each gate in the lane it planned, or the other players in a room.
 * @param settings Whether the race is solo, and the other players.
 * @param levelRun The level being run.
 * @returns The rivals.
 */
const createLevelRivals = (
  settings: Pick<RunSettings, 'solo' | 'rivals'>,
  levelRun: ShallowRef<LevelRun | null>
) =>
  createRivals(
    settings,
    (moved, fromDistance) => {
      const run = levelRun.value
      return run
        ? runThroughGates(run, moved, fromDistance, (gateIndex) => run.botLanes[gateIndex])
        : moved
    },
    (distance) => (levelRun.value ? botLaneAt(levelRun.value, distance) : CENTRE_LANE)
  )

/**
 * Lights a passed word's sign and shows the route piece its chosen lane ran onto.
 * @param scene The run's scene.
 * @param key The gate's key.
 * @param run The level being run.
 * @param gateIndex The gate passed.
 * @param chosenLane The lane the player took.
 */
const showPassedGate = (
  scene: RunScene,
  key: string,
  run: LevelRun,
  gateIndex: number,
  chosenLane: number
): void => {
  markPassedGate(scene.slots, key, run.gates[gateIndex], chosenLane, run.features[gateIndex])
}

/**
 * The player's impulse: ready again a few seconds after each use, and only mid-race. A new race
 * restarts the clock behind the last use, which reads as ready, so each race starts charged.
 * @param runSeconds The run clock.
 * @param running Whether the race is running.
 * @returns The charge, from 0 to 1, and use.
 */
const createImpulse = (runSeconds: Ref<number>, running: () => boolean) => {
  const lastUsedAt = ref(Number.NEGATIVE_INFINITY)
  const charge = computed(() =>
    runSeconds.value < lastUsedAt.value ? 1 : impulseCharge(runSeconds.value - lastUsedAt.value)
  )
  return {
    charge,
    /**
     * Spends the impulse if it is ready, and says whether it did.
     * @returns True when the impulse was spent.
     */
    use: (): boolean => {
      if (!running() || charge.value < 1) return false
      lastUsedAt.value = runSeconds.value
      return true
    }
  }
}

/**
 * One race through a level: a gate per word of the text, the player's lane through each, every
 * ball slowed or sped up by the lanes it takes, and the scene kept in step every frame. The
 * rival is the bot in a solo race, or the other players in a room. The first ball over the
 * finish line wins, and winning opens the next level.
 * @param settings The race's speed, steering, rivals and callbacks.
 * @returns The race state for the HUD, and functions to start, steer, step and dispose it.
 */
export const useWordRun = (settings: RunSettings) => {
  const phase = ref<RunPhase>('idle')
  const levelRun = shallowRef<LevelRun | null>(null)
  const runState = shallowRef<RunState>(createRunState())
  const report = shallowRef<RunReport | null>(null)
  const targetLane = ref(CENTRE_LANE)
  const score = createRunScore()
  const courses = createCourseHolder()
  const sendProgress = createProgressThrottle(settings.onProgress)
  const rivals = createLevelRivals(settings, levelRun)
  const { begin, steer } = createSteering(phase, targetLane, settings.steering)
  const motion = createPlayerMotion(settings)
  const impulses = createImpulse(score.runSeconds, () => phase.value === 'running')

  let scene: RunScene | null = null
  let drawRace: ReturnType<typeof createRaceDrawer> | null = null
  let player: Racer = createRacer()
  let attempt = 0
  let runSerial = 0
  let snapCamera = true
  let elapsed = 0

  /**
   * Lays a level out on its course with every ball on the start line. A room waits for go, and
   * a held race for the player to say they are ready.
   * @param levelId The level to lay out.
   * @param hold Whether to wait for the player to say they are ready.
   */
  const start = (levelId: string, hold = false): void => {
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
    rivals.reset()
    targetLane.value = CENTRE_LANE
    snapCamera = true
    score.reset(run.level.id)
    scene.slots.forEach(hideSlot)
    placeFinishLine(scene.finishLine, course.path.sampleAt(run.finishDistance))
    motion.holdAtStart(course.path)
    phase.value = settings.solo() && !hold ? 'running' : 'waiting'
  }

  /**
   * The verdict on a word, given the moment the player's ball goes through its gate.
   * @param run The level being run.
   * @param gateIndex The gate passed.
   */
  const passThrough = (run: LevelRun, gateIndex: number): void => {
    const chosenLane = motion.lane(targetLane.value)
    if (scene) showPassedGate(scene, gateKey(runSerial, gateIndex), run, gateIndex, chosenLane)
    runState.value = passGate(runState.value, run.gates[gateIndex], chosenLane)
  }

  const finishRun = (run: LevelRun): void => {
    settings.onFinish(score.runSeconds.value)
    report.value = settleRace(
      run,
      runState.value.results,
      score.runSeconds.value,
      rivals.standings()
    )
    score.settle(run.level.id, report.value.race.won)
    phase.value = 'finished'
  }

  /**
   * Moves every ball on, judges every gate the player went through, and settles the finish.
   * @param run The level being run.
   * @param path The course's track.
   * @param deltaSeconds Seconds since the last frame.
   */
  const advance = (run: LevelRun, path: TrackPath, deltaSeconds: number): void => {
    score.runSeconds.value += deltaSeconds
    const racing = {
      baseSpeed: settings.speed(),
      deltaSeconds,
      elapsedSeconds: score.runSeconds.value,
      finishDistance: run.finishDistance
    }
    const moved = motion.step(player, path, racing)
    // A word is judged, and its route settled, in the lane the ball went through it in.
    crossedGateIndices(player.distance, moved.distance, run.gateDistances).forEach((gateIndex) =>
      passThrough(run, gateIndex)
    )
    const lane = motion.lane(targetLane.value)
    player = runThroughGates(run, moved, player.distance, () => lane, motion.react)
    rivals.step(racing)
    const field = rivals.standings()
    const distances = [player.distance, ...field.map((rival) => rival.distance)]
    courses.current()?.advance(Math.max(...distances), Math.min(...distances))
    sendProgress(deltaSeconds, player.distance, motion.lateral(targetLane.value))
    if (player.finishSeconds !== null) finishRun(run)
  }

  /**
   * Advances the race by one frame and redraws everything that moved.
   * @param frameSeconds Seconds since the last frame, capped.
   */
  const stepRun = (frameSeconds: number): void => {
    const deltaSeconds = Math.min(frameSeconds, MAX_FRAME_SECONDS)
    elapsed += deltaSeconds
    const run = levelRun.value
    const course = courses.current()
    if (!scene || !drawRace || !course) return
    if (phase.value === 'running' && run) advance(run, course.path, deltaSeconds)
    else if (phase.value === 'finished') motion.stop()
    else motion.holdAtStart(course.path)
    const { view, frame } = framesFor({
      run: phase.value === 'idle' ? null : run,
      path: course.path,
      player,
      rivals: rivals.frames(),
      playerLateral: motion.lateral(targetLane.value),
      playerOnPhysics: motion.onPhysics(),
      runSerial,
      deltaSeconds,
      elapsed,
      snapCamera
    })
    drawRaceFrame(scene.slots, drawRace, view, frame)
    snapCamera = false
  }

  /**
   * Takes the scene once it exists, and lays the first level's course while a race is chosen.
   * @param runScene The scene, its balls and camera.
   */
  const attachScene = (runScene: RunScene): void => {
    scene = runScene
    drawRace = createRaceDrawer(runScene)
    motion.attach(runScene.playerBody, runScene.player)
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
    runSeconds: score.runSeconds,
    isNewBest: score.isNewBest,
    ...createReadouts(levelRun, runState),
    impulseCharge: impulses.charge,
    start,
    begin,
    steer,
    impulse: (): void => {
      if (impulses.use()) player = applyImpulse(player)
    },
    stepRun,
    attachScene,
    dispose
  }
}
