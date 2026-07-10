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

export const SAMPLE_MAPS: MarbleMap[] = [FUNNEL_FALLS, LOOP_LINE, JUMP_CANYON]
