import type { CoordinateTuple } from '@webgamekit/animation'
import type { PlacedPiece, PieceTransform } from './types'
import { PIECE_CATALOG } from './pieceCatalog'

const ORIGIN_TRANSFORM: PieceTransform = { position: [0, 0, 0], yaw: 0 }

export const applyPieceTransform = (
  transform: PieceTransform,
  localOffset: CoordinateTuple
): CoordinateTuple => {
  const [offsetX, offsetY, offsetZ] = localOffset
  const cos = Math.cos(transform.yaw)
  const sin = Math.sin(transform.yaw)
  return [
    transform.position[0] + offsetX * cos + offsetZ * sin,
    transform.position[1] + offsetY,
    transform.position[2] - offsetX * sin + offsetZ * cos
  ]
}

const advanceCursor = (cursor: PieceTransform, piece: PlacedPiece): PieceTransform => {
  const { exitOffset, exitYawDelta } = PIECE_CATALOG[piece.type]
  return {
    position: applyPieceTransform(cursor, exitOffset),
    yaw: cursor.yaw + exitYawDelta
  }
}

export const computeChainTransforms = (pieces: PlacedPiece[]): PieceTransform[] =>
  pieces.reduce<{ transforms: PieceTransform[]; cursor: PieceTransform }>(
    ({ transforms, cursor }, piece) => ({
      transforms: [...transforms, cursor],
      cursor: advanceCursor(cursor, piece)
    }),
    { transforms: [], cursor: ORIGIN_TRANSFORM }
  ).transforms
