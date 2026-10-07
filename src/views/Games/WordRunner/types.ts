import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
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

/** A word as the player picked it: the right word, the one taken, and whether they match. */
export type PickedWord = {
  position: number
  text: string
  chosen: string
  correct: boolean
}

/**
 * How the race ended, against the closest rival: the bot in a solo race, the other players
 * in a room. A win is measured in metres the rival still had to go, a loss in seconds.
 */
export type RaceResult =
  | { won: true; metresAhead: number; rivalName: string }
  | { won: false; secondsBehind: number; rivalName: string }

/** Another ball in the race, as far as the player can see it. */
export type Rival = {
  name: string
  distance: number
  finishSeconds: number | null
}

/** Where a room is: choosing a level in the lobby, or racing it. */
export type WrPhase = 'lobby' | 'race'

/** One player in the room, with where their ball is in the current race. */
export type WrPlayer = {
  id: string
  name: string
  color: string
  distance: number
  /** How far the ball is off the centreline, positive to the right. */
  lateral: number
  finishSeconds: number | null
  ready: boolean
}

export type WrAvatarPayload = { name: string; color: string }
/** How fast a race runs, for every ball in it: the player's, the bot's and every rival's. */
export type Difficulty = 'easy' | 'normal' | 'difficult' | 'extreme'

export type WrStartPayload = { levelId: string; difficulty: Difficulty }
export type WrProgressPayload = { distance: number; lateral: number }
export type WrFinishPayload = { seconds: number }

/** Who the local player is, and the room their session joins. */
export type WrSessionOptions = {
  name: string
  color: string
  roomId: string
}

/** Everything the end screen says about a finished level. */
export type RunReport = {
  race: RaceResult
  seconds: number
  correctCount: number
  wordCount: number
  picks: PickedWord[]
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

/**
 * Where a run is: not started, on the start line while the rest of the room loads the course,
 * racing, or over.
 */
export type RunPhase = 'idle' | 'waiting' | 'running' | 'finished'

/** What a run draws into, handed over once the scene exists. */
export type RunScene = {
  slots: GateSlot[]
  player: THREE.Mesh
  /** The player's ball in the physics world, for free steering; null when it steps lanes. */
  playerBody: RAPIER.RigidBody | null
  /** See-through balls for the rivals: the bot alone, or the other players in a room. */
  ghosts: THREE.Mesh[]
  finishLine: THREE.Object3D
  camera: THREE.Camera
  createCourse: (seed: number) => Course
}

/**
 * How the ball is steered: rolling freely under gravity anywhere across the track, or stepping
 * between the three lanes.
 */
export type SteeringMode = 'free' | 'lanes'

/** Settings read live from the Config panel, so changing them mid-run takes effect at once. */
export type RunSettings = {
  speed: () => number
  steering: SteeringMode
  /** Which way the player is holding the ball: -1 left, 1 right, 0 straight. */
  steerInput: () => number
  /** Whether the player is holding the brake. */
  brakeInput: () => boolean
  /** True with no one else in the room, when the bot is the rival. */
  solo: () => boolean
  /** The other players' balls, as the room last reported them. */
  rivals: () => RemoteRival[]
  onProgress: (distance: number, lateral: number) => void
  onFinish: (seconds: number) => void
}

/** Another player's ball, as the room last reported it. */
export type RemoteRival = Rival & {
  color: string
  lateral: number
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
  /** How far the ball is off the centreline, positive to the right. */
  lateral: number
  hop: number
}

/** A rival's ball for one frame, tinted in its player's colour, or untinted for the bot. */
export type RivalFrame = BallFrame & { color: string | null }

/** What the balls and the camera need for one frame. */
export type RaceFrame = {
  path: TrackPath
  player: BallFrame
  /** The player's ball moves under physics, so it is placed by its body, not by this frame. */
  playerOnPhysics: boolean
  rivals: RivalFrame[]
  deltaSeconds: number
  shake: number
  snapCamera: boolean
}

/**
 * What makes the right word's lane the better route at a gate: a ramp that speeds the ball
 * up, rocks blocking every other lane, or the inside line through a bend.
 */
export type RouteFeature = 'ramp' | 'rocks' | 'bend'

/** A piece of route that can appear in a lane once its word is picked. */
export type RoutePiece = 'ramp' | 'rock' | 'gravel'

/** What running a lane through a gate does to a ball. */
export type LaneOutcome = 'boost' | 'stumble' | 'wide' | 'miss' | 'none'

/** What changes a ball's speed for a moment: a lane it ran, or the player's own impulse. */
export type SpeedEffectKind = Exclude<LaneOutcome, 'none'> | 'impulse'

/** A speed change in progress, wearing off back to full speed. */
export type ActiveEffect = {
  outcome: SpeedEffectKind
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
