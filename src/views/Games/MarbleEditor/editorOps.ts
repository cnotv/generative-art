import type { MarbleMap, PlacedPiece, TrackPieceType } from './types'
import { PIECE_CATALOG } from './pieceCatalog'

const makePiece = (type: TrackPieceType): PlacedPiece => ({
  id: crypto.randomUUID(),
  type,
  color: PIECE_CATALOG[type].defaultColor
})

const withPieces = (map: MarbleMap, pieces: PlacedPiece[]): MarbleMap => ({
  ...map,
  pieces,
  updatedAt: Date.now()
})

const isTerminalType = (type: TrackPieceType): boolean => type === 'start' || type === 'finish'

export const createEmptyMap = (name: string): MarbleMap => ({
  version: 1,
  name,
  updatedAt: Date.now(),
  pieces: [makePiece('start'), makePiece('finish')]
})

export const appendPiece = (map: MarbleMap, type: TrackPieceType): MarbleMap => {
  if (isTerminalType(type) && map.pieces.some((piece) => piece.type === type)) return map
  const finishIndex = map.pieces.findIndex((piece) => piece.type === 'finish')
  const insertAt = type === 'start' ? 0 : finishIndex >= 0 ? finishIndex : map.pieces.length
  const target = type === 'finish' ? map.pieces.length : insertAt
  return withPieces(map, [
    ...map.pieces.slice(0, target),
    makePiece(type),
    ...map.pieces.slice(target)
  ])
}

export const insertPiece = (map: MarbleMap, index: number, type: TrackPieceType): MarbleMap => {
  if (isTerminalType(type)) return map
  const hasStart = map.pieces[0]?.type === 'start'
  const finishIndex = map.pieces.findIndex((piece) => piece.type === 'finish')
  const minIndex = hasStart ? 1 : 0
  const maxIndex = finishIndex >= 0 ? finishIndex : map.pieces.length
  const clamped = Math.min(Math.max(index, minIndex), maxIndex)
  return withPieces(map, [
    ...map.pieces.slice(0, clamped),
    makePiece(type),
    ...map.pieces.slice(clamped)
  ])
}

export const removePiece = (map: MarbleMap, pieceId: string): MarbleMap => {
  const target = map.pieces.find((piece) => piece.id === pieceId)
  if (!target || isTerminalType(target.type)) return map
  return withPieces(
    map,
    map.pieces.filter((piece) => piece.id !== pieceId)
  )
}

export const recolorPiece = (map: MarbleMap, pieceId: string, color: number): MarbleMap => {
  if (!map.pieces.some((piece) => piece.id === pieceId)) return map
  return withPieces(
    map,
    map.pieces.map((piece) => (piece.id === pieceId ? { ...piece, color } : piece))
  )
}
