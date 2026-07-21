import type { MarbleMap, TrackPieceType } from './types'
import { PIECE_CATALOG } from './pieceCatalog'

const makeSampleMap = (name: string, slug: string, types: TrackPieceType[]): MarbleMap => ({
  version: 1,
  name,
  updatedAt: 0,
  pieces: types.map((type, index) => ({
    id: `${slug}-${index}`,
    type,
    color: PIECE_CATALOG[type].defaultColor
  }))
})

const FUNNEL_FALLS = makeSampleMap('Funnel Falls', 'funnel-falls', [
  'start',
  'ramp-down',
  'funnel',
  'banked-left',
  'straight-long',
  'banked-right',
  'finish'
])

const LOOP_LINE = makeSampleMap('Loop Line', 'loop-line', [
  'start',
  'ramp-down',
  'ramp-down',
  'straight-short',
  'loop',
  'straight-long',
  'finish'
])

const JUMP_CANYON = makeSampleMap('Jump Canyon', 'jump-canyon', [
  'start',
  'ramp-down',
  'gap-jump',
  'straight-short',
  'funnel',
  'ramp-down',
  'boost-pad',
  'loop',
  'straight-short',
  'finish'
])

const ENDLESS_DROP_SEGMENTS = 15
const ENDLESS_DROP_RAMPS_PER_RUN = 5

// A serpentine descent: runs of downward ramps chained by flat 180-degree banked
// U-turns that alternate direction each segment, so the track keeps losing height
// and never climbs while folding back and forth instead of stacking. Yields
// 1 + 15 * (5 + 2) + 1 = 107 pieces.
const endlessDropTypes = (): TrackPieceType[] =>
  Array.from({ length: ENDLESS_DROP_SEGMENTS }, (_, segment) => {
    const bank: TrackPieceType = segment % 2 === 0 ? 'banked-left' : 'banked-right'
    return [
      ...Array.from({ length: ENDLESS_DROP_RAMPS_PER_RUN }, () => 'ramp-down' as TrackPieceType),
      bank,
      bank
    ]
  }).flat()

const ENDLESS_DROP = makeSampleMap('Endless Drop', 'endless-drop', [
  'start',
  ...endlessDropTypes(),
  'finish'
])

export const SAMPLE_MAPS: MarbleMap[] = [FUNNEL_FALLS, LOOP_LINE, JUMP_CANYON, ENDLESS_DROP]
