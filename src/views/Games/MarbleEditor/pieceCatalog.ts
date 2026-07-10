import type { PieceSpec, TrackPieceType } from './types'
import {
  START_LENGTH,
  FINISH_LENGTH,
  STRAIGHT_SHORT_LENGTH,
  STRAIGHT_LONG_LENGTH,
  CURVE_RADIUS,
  RAMP_LENGTH,
  RAMP_ANGLE,
  FUNNEL_DROP_HEIGHT,
  FUNNEL_EXIT_LENGTH,
  LOOP_EXIT_LENGTH,
  GAP_JUMP_LENGTH,
  GAP_JUMP_DROP,
  BOOST_PAD_LENGTH,
  BUMPER_FIELD_LENGTH,
  COLOR_START,
  COLOR_FINISH,
  COLOR_STRAIGHT,
  COLOR_CURVE,
  COLOR_BANKED,
  COLOR_RAMP,
  COLOR_FUNNEL,
  COLOR_LOOP,
  COLOR_GAP_JUMP,
  COLOR_BOOST,
  COLOR_BUMPER
} from './config'

const RAMP_RISE = RAMP_LENGTH * Math.sin(RAMP_ANGLE)
const RAMP_RUN = RAMP_LENGTH * Math.cos(RAMP_ANGLE)

export const PIECE_CATALOG: Record<TrackPieceType, PieceSpec> = {
  start: {
    type: 'start',
    label: 'Start',
    defaultColor: COLOR_START,
    exitOffset: [0, 0, -START_LENGTH],
    exitYawDelta: 0
  },
  finish: {
    type: 'finish',
    label: 'Finish',
    defaultColor: COLOR_FINISH,
    exitOffset: [0, 0, -FINISH_LENGTH],
    exitYawDelta: 0
  },
  'straight-short': {
    type: 'straight-short',
    label: 'Straight',
    defaultColor: COLOR_STRAIGHT,
    exitOffset: [0, 0, -STRAIGHT_SHORT_LENGTH],
    exitYawDelta: 0
  },
  'straight-long': {
    type: 'straight-long',
    label: 'Long straight',
    defaultColor: COLOR_STRAIGHT,
    exitOffset: [0, 0, -STRAIGHT_LONG_LENGTH],
    exitYawDelta: 0
  },
  'curve-left': {
    type: 'curve-left',
    label: 'Curve left',
    defaultColor: COLOR_CURVE,
    exitOffset: [-CURVE_RADIUS, 0, -CURVE_RADIUS],
    exitYawDelta: Math.PI / 2
  },
  'curve-right': {
    type: 'curve-right',
    label: 'Curve right',
    defaultColor: COLOR_CURVE,
    exitOffset: [CURVE_RADIUS, 0, -CURVE_RADIUS],
    exitYawDelta: -Math.PI / 2
  },
  'banked-left': {
    type: 'banked-left',
    label: 'Banked left',
    defaultColor: COLOR_BANKED,
    exitOffset: [-CURVE_RADIUS, 0, -CURVE_RADIUS],
    exitYawDelta: Math.PI / 2
  },
  'banked-right': {
    type: 'banked-right',
    label: 'Banked right',
    defaultColor: COLOR_BANKED,
    exitOffset: [CURVE_RADIUS, 0, -CURVE_RADIUS],
    exitYawDelta: -Math.PI / 2
  },
  'ramp-up': {
    type: 'ramp-up',
    label: 'Ramp up',
    defaultColor: COLOR_RAMP,
    exitOffset: [0, RAMP_RISE, -RAMP_RUN],
    exitYawDelta: 0
  },
  'ramp-down': {
    type: 'ramp-down',
    label: 'Ramp down',
    defaultColor: COLOR_RAMP,
    exitOffset: [0, -RAMP_RISE, -RAMP_RUN],
    exitYawDelta: 0
  },
  funnel: {
    type: 'funnel',
    label: 'Funnel',
    defaultColor: COLOR_FUNNEL,
    exitOffset: [0, -FUNNEL_DROP_HEIGHT, -FUNNEL_EXIT_LENGTH],
    exitYawDelta: 0
  },
  loop: {
    type: 'loop',
    label: 'Loop',
    defaultColor: COLOR_LOOP,
    exitOffset: [0, 0, -LOOP_EXIT_LENGTH],
    exitYawDelta: 0
  },
  'gap-jump': {
    type: 'gap-jump',
    label: 'Gap jump',
    defaultColor: COLOR_GAP_JUMP,
    exitOffset: [0, -GAP_JUMP_DROP, -GAP_JUMP_LENGTH],
    exitYawDelta: 0
  },
  'boost-pad': {
    type: 'boost-pad',
    label: 'Boost pad',
    defaultColor: COLOR_BOOST,
    exitOffset: [0, 0, -BOOST_PAD_LENGTH],
    exitYawDelta: 0
  },
  'bumper-field': {
    type: 'bumper-field',
    label: 'Bumper field',
    defaultColor: COLOR_BUMPER,
    exitOffset: [0, 0, -BUMPER_FIELD_LENGTH],
    exitYawDelta: 0
  }
}

export const PIECE_TYPES = Object.keys(PIECE_CATALOG) as TrackPieceType[]

export const PLACEABLE_PIECE_TYPES = PIECE_TYPES.filter(
  (type) => type !== 'start' && type !== 'finish'
)
