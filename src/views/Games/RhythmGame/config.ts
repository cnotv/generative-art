import { midiNoteToFreq } from '@webgamekit/audio'
import type { ControlMapping } from '@webgamekit/controls'
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

export const LANE_MIDI_NOTES = [60, 64, 67, 72] as const
export const LANE_FREQS = LANE_MIDI_NOTES.map(midiNoteToFreq) as [number, number, number, number]

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
  notes: Record<RgDifficulty, RhythmNote[]>
}

const ms = (beats: number, bpm: number): number => Math.round((beats * 60000) / bpm)

const buildNotes = (pattern: [RgLane, number][], bpm: number): RhythmNote[] =>
  pattern.map(([lane, beat]) => ({
    lane,
    midiNote: LANE_MIDI_NOTES[lane],
    time: ms(beat, bpm)
  }))

const electricEasy = (bpm: number): RhythmNote[] =>
  buildNotes(
    Array.from({ length: 32 }, (_, i) => [(i % 4) as RgLane, i]),
    bpm
  )

const electricMedium = (bpm: number): RhythmNote[] =>
  buildNotes(
    Array.from({ length: 8 }, (_, bar) =>
      Array.from({ length: 4 }, (_, b): [RgLane, number][] => [
        [(b % 4) as RgLane, bar * 4 + b],
        ...(b % 2 === 0 ? [[((b + 2) % 4) as RgLane, bar * 4 + b + 0.5] as [RgLane, number]] : [])
      ]).flat()
    ).flat(),
    bpm
  )

const electricHard = (bpm: number): RhythmNote[] =>
  buildNotes(
    Array.from({ length: 8 }, (_, bar) =>
      Array.from({ length: 4 }, (_, b): [RgLane, number][] => {
        const base = bar * 4 + b
        return [
          [(b % 4) as RgLane, base],
          [((b + 1) % 4) as RgLane, base + 0.25],
          [((b + 2) % 4) as RgLane, base + 0.5],
          [((b + 3) % 4) as RgLane, base + 0.75]
        ]
      }).flat()
    ).flat(),
    bpm
  )

const neonPattern: [RgLane, number][] = [
  [0, 0],
  [2, 0.5],
  [1, 1.5],
  [3, 2],
  [0, 2.5],
  [1, 3],
  [2, 3.5],
  [3, 4],
  [1, 4.5],
  [0, 5],
  [3, 5.5],
  [2, 6],
  [0, 7],
  [1, 7.5],
  [3, 8],
  [2, 8.5],
  [0, 9],
  [3, 9.5],
  [1, 10],
  [2, 10.5],
  [3, 11],
  [0, 11.5],
  [2, 12],
  [1, 12.5],
  [0, 13],
  [2, 13.5],
  [1, 14],
  [3, 14.5],
  [0, 15],
  [1, 15.5],
  [2, 16],
  [3, 16.5]
]

const stormPatternHard: [RgLane, number][] = Array.from({ length: 64 }, (_, i) => [
  (i % 4) as RgLane,
  i * 0.5
])

export const SONGS: RgSongDef[] = [
  {
    id: 'electric-pulse',
    label: 'Electric Pulse',
    bpm: 120,
    notes: {
      easy: electricEasy(120),
      medium: electricMedium(120),
      hard: electricHard(120)
    }
  },
  {
    id: 'neon-chase',
    label: 'Neon Chase',
    bpm: 128,
    notes: {
      easy: buildNotes(
        neonPattern.filter((_, i) => i % 2 === 0),
        128
      ),
      medium: buildNotes(neonPattern, 128),
      hard: buildNotes(
        [
          ...neonPattern,
          ...neonPattern.map(([l, b]) => [((l + 2) % 4) as RgLane, b + 0.25] as [RgLane, number])
        ].sort((a, b) => a[1] - b[1]),
        128
      )
    }
  },
  {
    id: 'grid-storm',
    label: 'Grid Storm',
    bpm: 140,
    notes: {
      easy: buildNotes(
        stormPatternHard.filter((_, i) => i % 4 === 0),
        140
      ),
      medium: buildNotes(
        stormPatternHard.filter((_, i) => i % 2 === 0),
        140
      ),
      hard: buildNotes(stormPatternHard, 140)
    }
  }
]
