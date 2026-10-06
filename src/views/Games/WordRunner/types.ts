import type * as THREE from 'three'
import type { ComplexModel } from '@webgamekit/threejs'
import type { TrackPath, TrackSample } from '@/views/Games/RockRunner/types'

export type { TrackPath, TrackSample }

/** One word of a phrase, with what it means and the look-alikes offered against it. */
export type PhraseWord = {
  text: string
  gloss: string
  decoys: string[]
}

/** A sequence of words to memorise, run as one gate per word. */
export type Phrase = {
  id: string
  title: string
  translation: string
  words: PhraseWord[]
}

/** Every phrase of one language. */
export type LanguagePack = {
  language: string
  languageName: string
  phrases: Phrase[]
}

/**
 * How much help a gate gives: `full` glows the right lane from afar and shows the gloss,
 * `late` glows it only close to the gate, `none` gives nothing away.
 */
export type HintLevel = 'full' | 'late' | 'none'

/** One gate of a lap: which word of the phrase it asks for and how much it helps. */
export type LapWord = {
  position: number
  chunk: number
  hint: HintLevel
}

/**
 * One run along the track. `shuffled` deals every correct word into a lane other than its
 * usual one; `attempt` counts how many times in a row this lap has been re-run after a
 * mistake, zero for the lap as first scheduled.
 */
export type Lap = {
  words: LapWord[]
  shuffled: boolean
  attempt: number
}

/** What every gate of a phrase is dealt from: the phrase, its seed, the lanes and spare words. */
export type GateDeal = {
  phrase: Phrase
  seed: number
  laneCount: number
  fallbackPool: string[]
}

/** A gate as it stands on the track: a word per lane, one of them right. */
export type Gate = {
  position: number
  options: string[]
  correctLane: number
  hint: HintLevel
}

/** What happened when the runner went through a gate. */
export type GateResult = {
  position: number
  chosenLane: number
  correct: boolean
}

/** Every gate result of one finished lap. */
export type LapRecord = {
  lapIndex: number
  results: GateResult[]
}

/** Where the runner is in the lap schedule, and what has been answered so far. */
export type RunState = {
  laps: Lap[]
  lapIndex: number
  gateIndex: number
  currentResults: GateResult[]
  history: LapRecord[]
  finished: boolean
}

/** How one word of the phrase went across the whole run. */
export type WordSummary = {
  position: number
  attempts: number
  correct: number
}

/** How a word sign is drawn: plain, glowing as a hint, or the verdict after it is passed. */
export type SignState = 'idle' | 'hint' | 'right' | 'wrong' | 'reveal'

/** One pooled gate on the track, reused for whichever gate of the lap comes into view. */
export type GateSlot = {
  group: THREE.Group
  signs: GateSign[]
  features: GateFeatures
  frameMaterial: THREE.MeshLambertMaterial
  gateKey: string | null
}

/** The route pieces a gate leads onto: a ramp, and a rock and a gravel patch per lane. */
export type GateFeatures = {
  group: THREE.Group
  ramp: THREE.Mesh
  rocks: THREE.Mesh[]
  gravel: THREE.Mesh[]
}

/** One lane's word on a gate, drawn into its own canvas so it can be redrawn in place. */
export type GateSign = {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  canvas: HTMLCanvasElement
  texture: THREE.CanvasTexture
  word: string
  state: SignState
}

/** A word the runner has passed this lap, as the sentence along the top shows it. */
export type RibbonWord = {
  text: string
  correct: boolean
}

/** Where a run is: waiting to start, on a lap, between laps, or over. */
export type RunPhase = 'idle' | 'running' | 'recap' | 'finished'

/** What a run draws into, handed over once the scene exists. */
export type RunScene = {
  slots: GateSlot[]
  runner: ComplexModel
  runnerFootLift: number
  camera: THREE.Camera
  createCourse: (seed: number) => Course
}

/** Settings read live from the Config panel, so changing them mid-run takes effect at once. */
export type RunSettings = {
  speed: () => number
}

/** The word just passed, shown briefly with its meaning and whether the lane was right. */
export type RunFeedback = {
  text: string
  gloss: string
  correct: boolean
}

/** Where the gates of the current lap stand relative to the runner, for one frame. */
export type GateView = {
  path: TrackPath
  gates: Gate[]
  features: RouteFeature[]
  distances: number[]
  distance: number
  lapSerial: number
}

/** What the runner and camera need for one frame. */
export type RunnerFrame = {
  path: TrackPath
  distance: number
  targetLane: number
  isMoving: boolean
  deltaSeconds: number
  shake: number
  hop: number
  snapCamera: boolean
}

/**
 * What makes the right word's lane the better route at a gate: a ramp that speeds the runner
 * up, rocks blocking every other lane, or the inside line through a bend.
 */
export type RouteFeature = 'ramp' | 'rocks' | 'bend'

/** What running a lane through a gate does to the runner. */
export type LaneOutcome = 'boost' | 'stumble' | 'wide' | 'none'

/** A speed change in progress, wearing off back to full speed. */
export type ActiveEffect = {
  outcome: Exclude<LaneOutcome, 'none'>
  remaining: number
}

/** One phrase's course: the track every lap of it runs on, and how to take it down. */
export type Course = {
  path: TrackPath
  dispose: () => void
}
