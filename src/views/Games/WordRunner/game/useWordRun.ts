import { computed, ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import {
  CHUNK_SIZE,
  FEEDBACK_SECONDS,
  GATE_SPACING,
  LANE_COUNT,
  LEAD_IN_DISTANCE,
  MAX_RETRY_ATTEMPTS,
  RECAP_SECONDS,
  ROUTE_EFFECTS,
  STUMBLE_SHAKE,
  STUMBLE_SHAKE_FREQUENCY
} from '../config'
import { buildLapSchedule } from '../sequence/lapSchedule'
import { buildCorrectLanes, buildLapGates, phraseSeed } from '../sequence/gateLayout'
import { createRunState, passGate, summarizeWords } from '../sequence/progress'
import { crossedGateIndices, gateDistances, stepLane } from '../runner/runMotion'
import { effectSpeedRatio, startEffect, tickEffect } from '../runner/routeAdvantage'
import { hideSlot } from '../scene/gatePool'
import { createRunnerDrawer, drawGates, gateKey, markPassedGate } from './drawRun'
import type {
  ActiveEffect,
  Gate,
  GateDeal,
  LanguagePack,
  Phrase,
  RibbonWord,
  RunFeedback,
  RunnerFrame,
  RunPhase,
  RunScene,
  RunSettings,
  RunState
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

/** Everything a run of one phrase is dealt from: its gates' seed, its fixed lanes, its laps. */
const prepareRun = (pack: LanguagePack, phraseId: string) => {
  const phrase = pack.phrases.find((candidate) => candidate.id === phraseId) ?? pack.phrases[0]
  const seed = phraseSeed(phrase.id)
  const deal: GateDeal = { phrase, seed, laneCount: LANE_COUNT, fallbackPool: [] }
  return {
    deal,
    correctLanes: buildCorrectLanes(seed, phrase.words.length, LANE_COUNT),
    runState: createRunState(buildLapSchedule(phrase.words.length, CHUNK_SIZE))
  }
}

/**
 * One run through a phrase: the lap schedule, the gate under each lane, the runner's lane,
 * and the scene kept in step with all of it every frame.
 */
export const useWordRun = (pack: LanguagePack, settings: RunSettings) => {
  const phase = ref<RunPhase>('idle')
  const phrase = shallowRef<Phrase>(pack.phrases[0])
  const runState = shallowRef<RunState>(createRunState([]))
  const lapGates = shallowRef<Gate[]>([])
  const ribbon = ref<RibbonWord[]>([])
  const feedback = ref<RunFeedback | null>(null)
  const targetLane = ref(CENTRE_LANE)

  let scene: RunScene | null = null
  let drawRunner: ((frame: RunnerFrame) => void) | null = null
  let deal: GateDeal | null = null
  let correctLanes: number[] = []
  let distances: number[] = []
  let distance = 0
  let elapsed = 0
  let effect: ActiveEffect | null = null
  let recapRemaining = 0
  let feedbackRemaining = 0
  // Keys the pooled gates by lap as it is run, not by lap index: the index moves on the
  // moment the last gate is passed, while that gate is still on screen during the recap.
  let lapSerial = 0

  const startLap = (): void => {
    if (!deal) return
    const { lapIndex, laps } = runState.value
    lapGates.value = buildLapGates(deal, laps[lapIndex], lapIndex, correctLanes)
    distances = gateDistances(distance, lapGates.value.length, LEAD_IN_DISTANCE, GATE_SPACING)
    ribbon.value = []
    lapSerial += 1
    scene?.slots.forEach(hideSlot)
    phase.value = 'running'
  }

  const start = (phraseId: string): void => {
    const prepared = prepareRun(pack, phraseId)
    phrase.value = prepared.deal.phrase
    deal = prepared.deal
    correctLanes = prepared.correctLanes
    runState.value = prepared.runState
    targetLane.value = CENTRE_LANE
    effect = null
    feedback.value = null
    startLap()
  }

  const steer = (direction: number): void => {
    if (phase.value !== 'running' && phase.value !== 'recap') return
    targetLane.value = stepLane(targetLane.value, direction, LANE_COUNT)
  }

  const passThrough = (gateIndex: number): void => {
    const gate = lapGates.value[gateIndex]
    const chosenLane = targetLane.value
    const correct = chosenLane === gate.correctLane
    const word = phrase.value.words[gate.position]
    if (scene) markPassedGate(scene.slots, gateKey(lapSerial, gateIndex), gate, chosenLane)
    feedback.value = { text: word.text, gloss: word.gloss, correct }
    feedbackRemaining = FEEDBACK_SECONDS
    ribbon.value = [...ribbon.value, { text: word.text, correct }]
    if (!correct) effect = startEffect('stumble')

    const previousLap = runState.value.lapIndex
    runState.value = passGate(runState.value, gate, chosenLane, MAX_RETRY_ATTEMPTS)
    if (runState.value.lapIndex === previousLap) return
    phase.value = 'recap'
    recapRemaining = RECAP_SECONDS
  }

  const advanceRecap = (deltaSeconds: number): void => {
    recapRemaining -= deltaSeconds
    if (recapRemaining > 0) return
    if (runState.value.finished) {
      phase.value = 'finished'
      scene?.slots.forEach(hideSlot)
    } else startLap()
  }

  const advance = (deltaSeconds: number): void => {
    const previousDistance = distance
    effect = tickEffect(effect, deltaSeconds)
    const speed = settings.speed() * effectSpeedRatio(effect)
    distance += speed * deltaSeconds
    if (phase.value === 'recap') advanceRecap(deltaSeconds)
    else crossedGateIndices(previousDistance, distance, distances).forEach(passThrough)
  }

  /** Advances the run by one frame and redraws everything that moved. */
  const stepRun = (deltaSeconds: number): void => {
    elapsed += deltaSeconds
    feedbackRemaining = Math.max(0, feedbackRemaining - deltaSeconds)
    if (feedbackRemaining === 0 && feedback.value) feedback.value = null
    const isMoving = phase.value === 'running' || phase.value === 'recap'
    if (isMoving) advance(deltaSeconds)
    if (!scene || !drawRunner) return
    scene.scrollTrack(distance)
    drawGates(scene.slots, { gates: lapGates.value, distances, distance, lapSerial })
    const stumbleShare =
      effect?.outcome === 'stumble' ? effect.remaining / ROUTE_EFFECTS.stumble.seconds : 0
    const shake = Math.sin(elapsed * STUMBLE_SHAKE_FREQUENCY) * STUMBLE_SHAKE * stumbleShare
    drawRunner({ targetLane: targetLane.value, isMoving, deltaSeconds, shake })
  }

  const backToStart = (): void => {
    ribbon.value = []
    feedback.value = null
    targetLane.value = CENTRE_LANE
    distances = []
    scene?.slots.forEach(hideSlot)
    phase.value = 'idle'
  }

  const attachScene = (runScene: RunScene): void => {
    scene = runScene
    drawRunner = createRunnerDrawer(runScene)
  }

  const dispose = (): void => {
    scene = null
  }

  const readouts = createReadouts(phase, phrase, runState, lapGates)

  return {
    phase,
    phrase,
    ribbon,
    feedback,
    ...readouts,
    start,
    steer,
    backToStart,
    stepRun,
    attachScene,
    dispose
  }
}
