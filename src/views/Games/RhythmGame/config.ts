import type { ControlMapping } from '@webgamekit/controls'
import electricPulseBacking from '@/assets/audio/rhythmgame/electric-pulse.mp3'
import electricPulseChart from '@/assets/audio/rhythmgame/electric-pulse.mid?url'
import gridStormBacking from '@/assets/audio/rhythmgame/grid-storm.mp3'
import gridStormChart from '@/assets/audio/rhythmgame/grid-storm.mid?url'
import neonChaseBacking from '@/assets/audio/rhythmgame/neon-chase.mp3'
import neonChaseChart from '@/assets/audio/rhythmgame/neon-chase.mid?url'
import type {
  MapperActionConfig,
  ControlsMapperGameConfig
} from '@/components/ControlsMapper/types'

export const LANES = 4
export const HIT_WINDOW_PERFECT_MS = 50
export const HIT_WINDOW_GOOD_MS = 120
export const NOTE_SPEED_PX_PER_MS = 0.35
export const HIT_ZONE_RATIO = 0.82
export const NOTE_HEIGHT = 28
export const NOTE_RADIUS = 8
export const COMBO_THRESHOLDS = [10, 25, 50] as const
export const COMBO_MULTIPLIERS = [2, 4, 8] as const
export const SCORE_PERFECT = 300
export const SCORE_GOOD = 100
export const MATCHMAKER_ROOM = 'rhythm-game-matchmaker'

export const LANE_COLORS = ['#00e5ff', '#ff4081', '#ffd740', '#69ff47'] as const
export const LANE_KEYS = ['D', 'F', 'J', 'K'] as const
export const LANE_DIRECTIONS = ['left', 'down', 'up', 'right'] as const

export const CONTROLS_GAME_ID = 'rhythm-game'

export const CONTROLS_ACTIONS: MapperActionConfig[] = LANE_KEYS.map((key, index) => ({
  id: `lane-${index}`,
  label: `Lane ${index + 1} (${key})`,
  directional: true
}))

export const CONTROLS_DEFAULT_MAPPING: ControlMapping = {
  keyboard: Object.fromEntries([
    ...LANE_KEYS.map((key, index) => [key.toLowerCase(), `lane-${index}`]),
    ...LANE_KEYS.map((key, index) => [key.toUpperCase(), `lane-${index}`]),
    ['ArrowLeft', 'lane-0'],
    ['ArrowDown', 'lane-1'],
    ['ArrowUp', 'lane-2'],
    ['ArrowRight', 'lane-3']
  ]),
  'faux-pad': Object.fromEntries(
    LANE_DIRECTIONS.map((direction, index) => [direction, `lane-${index}`])
  ),
  gamepad: {
    'dpad-left': 'lane-0',
    'dpad-down': 'lane-1',
    'dpad-up': 'lane-2',
    'dpad-right': 'lane-3'
  }
}

export const CONTROLS_CONFIG: ControlsMapperGameConfig = {
  gameId: CONTROLS_GAME_ID,
  actions: CONTROLS_ACTIONS,
  defaultMapping: CONTROLS_DEFAULT_MAPPING
}

export type RgDifficulty = 'easy' | 'medium' | 'hard'
export type RgSong = 'electric-pulse' | 'neon-chase' | 'grid-storm' | 'custom'
export type RgLane = 0 | 1 | 2 | 3
export type RgInstrument = 'piano' | 'bass' | 'guitar'

type InstrumentPreset = {
  waveType: 'sine' | 'square' | 'sawtooth' | 'triangle'
  durationMs: number
  volume: number
  freqMultiplier: number
  attackTimeSec: number
}

export const INSTRUMENT_PRESETS: Record<RgInstrument, InstrumentPreset> = {
  piano: {
    waveType: 'triangle',
    durationMs: 90,
    volume: 0.25,
    freqMultiplier: 1,
    attackTimeSec: 0.005
  },
  bass: {
    waveType: 'triangle',
    durationMs: 220,
    volume: 0.3,
    freqMultiplier: 0.5,
    attackTimeSec: 0.003
  },
  guitar: {
    waveType: 'sawtooth',
    durationMs: 110,
    volume: 0.2,
    freqMultiplier: 1,
    attackTimeSec: 0.002
  }
}
export type HitResult = 'perfect' | 'good' | 'miss'

export type RhythmNote = {
  lane: RgLane
  midiNote: number
  time: number
  hit?: HitResult
}

export type RgSongDef = {
  id: RgSong
  label: string
  bpm: number
  backingUrl: string
  chartUrl: string
}

/** Under 1, so the notes the player plays sit on top of the song. */
export const BACKING_VOLUME = 0.7

export const DIFFICULTIES: { id: RgDifficulty; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' }
]

export const SONGS: RgSongDef[] = [
  {
    id: 'electric-pulse',
    label: 'Electric Pulse',
    bpm: 120,
    backingUrl: electricPulseBacking,
    chartUrl: electricPulseChart
  },
  {
    id: 'neon-chase',
    label: 'Neon Chase',
    bpm: 128,
    backingUrl: neonChaseBacking,
    chartUrl: neonChaseChart
  },
  {
    id: 'grid-storm',
    label: 'Grid Storm',
    bpm: 140,
    backingUrl: gridStormBacking,
    chartUrl: gridStormChart
  }
]
