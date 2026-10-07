import type * as THREE from 'three'
import type { TrackPath, TrackSample } from '@/views/Games/RockRunner/types'

export type { TrackPath, TrackSample }

/** One word of a level's text, with what it means and the look-alikes offered against it. */
export type LevelWord = {
  /** What opens a clause before the word, such as Spanish ¡ or ¿. Never on the sign. */
  opening?: string
  text: string
  gloss: string
  decoys: string[]
  /** What follows the word in the text, such as a comma or a full stop. Never on the sign. */
  punctuation?: string
}

/** One sentence of a level's text, with the English it is read against. */
export type LevelSentence = {
  translation: string
  words: LevelWord[]
}

/** The Common European Framework of Reference (CEFR) levels, from beginner to mastery. */
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

/** One level: a connected text about one everyday situation, run once as one gate per word. */
export type Level = {
  id: string
  cefr: CefrLevel
  title: string
  situation: string
  sentences: LevelSentence[]
}

/** Every level of one language, A1 first. */
export type LanguagePack = {
  language: string
  languageName: string
  levels: Level[]
}

/** What a CEFR level means, the same in every language: its name and what clearing it shows. */
export type CefrDescription = {
  label: string
  canDo: string
}

/**
 * How much help a gate gives: `full` glows the right lane from afar and shows the gloss,
 * `late` glows it only close to the gate, `none` gives nothing away.
 */
export type HintLevel = 'full' | 'late' | 'none'

/** What every gate of a level is dealt from: its words, its seed, the lanes and spare words. */
export type GateDeal = {
  words: LevelWord[]
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

/** What happened when the player went through a gate. */
export type GateResult = {
  position: number
  chosenLane: number
  correct: boolean
}

/** How far through the text the player is, and what has been answered so far. */
export type RunState = {
  gateIndex: number
  results: GateResult[]
}

/** A word the player went through the wrong lane for, and what they took instead. */
export type MissedWord = {
  position: number
  text: string
  gloss: string
  chosen: string
}

/** How the race against the bot ended: who got there first, and by how much. */
export type RaceResult = { won: true; metresAhead: number } | { won: false; secondsBehind: number }

/** Everything the end screen says about a finished level. */
export type RunReport = {
  race: RaceResult
  seconds: number
  correctCount: number
  wordCount: number
  missed: MissedWord[]
  tip: string
}

/** How a word sign is drawn: plain, glowing as a hint, or the verdict after it is passed. */
export type SignState = 'idle' | 'hint' | 'right' | 'wrong' | 'reveal'

/** One pooled gate on the track, reused for whichever gate of the text comes into view. */
export type GateSlot = {
  group: THREE.Group
  signs: GateSign[]
  features: GateFeatures
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

/** A word of the current sentence the player has passed, as the HUD builds the sentence. */
export type RibbonWord = {
  text: string
  correct: boolean
}

/** Where a run is: waiting to start, racing, or over. */
export type RunPhase = 'idle' | 'running' | 'finished'

/** What a run draws into, handed over once the scene exists. */
export type RunScene = {
  slots: GateSlot[]
  player: THREE.Mesh
  bot: THREE.Mesh
  finishLine: THREE.Object3D
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

/** Where the gates of the level stand relative to the player, for one frame. */
export type GateView = {
  path: TrackPath
  gates: Gate[]
  features: RouteFeature[]
  distances: number[]
  distance: number
  runSerial: number
}

/** Where one ball is this frame, and how it moves. */
export type BallFrame = {
  distance: number
  lane: number
  hop: number
}

/** What the balls and the camera need for one frame. */
export type RaceFrame = {
  path: TrackPath
  player: BallFrame
  bot: BallFrame
  deltaSeconds: number
  shake: number
  snapCamera: boolean
}

/**
 * What makes the right word's lane the better route at a gate: a ramp that speeds the ball
 * up, rocks blocking every other lane, or the inside line through a bend.
 */
export type RouteFeature = 'ramp' | 'rocks' | 'bend'

/** What running a lane through a gate does to a ball. */
export type LaneOutcome = 'boost' | 'stumble' | 'wide' | 'miss' | 'none'

/** A speed change in progress, wearing off back to full speed. */
export type ActiveEffect = {
  outcome: Exclude<LaneOutcome, 'none'>
  remaining: number
}

/** One ball in the race: how far along it is, what is slowing or speeding it, and its finish. */
export type Racer = {
  distance: number
  effect: ActiveEffect | null
  hopRemaining: number
  finishSeconds: number | null
}

/**
 * One level's course: the track it runs on, streamed ahead of the leading ball and taken
 * down behind the trailing one, and rebuilt from the start for another attempt.
 */
export type Course = {
  path: TrackPath
  advance: (leadingDistance: number, trailingDistance: number) => void
  restart: () => void
  dispose: () => void
}
