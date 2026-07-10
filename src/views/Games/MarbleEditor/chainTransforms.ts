import type { PlacedPiece, PieceTransform } from './types'
import { PIECE_CATALOG } from './pieceCatalog'

const ORIGIN_TRANSFORM: PieceTransform = { position: [0, 0, 0], yaw: 0 }

const advanceCursor = (cursor: PieceTransform, piece: PlacedPiece): PieceTransform => {
  const { exitOffset, exitYawDelta } = PIECE_CATALOG[piece.type]
  const [offsetX, offsetY, offsetZ] = exitOffset
  const cos = Math.cos(cursor.yaw)
  const sin = Math.sin(cursor.yaw)
  return {
    position: [
      cursor.position[0] + offsetX * cos + offsetZ * sin,
      cursor.position[1] + offsetY,
      cursor.position[2] - offsetX * sin + offsetZ * cos
    ],
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
