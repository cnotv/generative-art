import type { PixelBox } from '../../types'
import { runsAlong } from './scoreMasks'

export type InkComponent = PixelBox & { pixelCount: number }

type RowRun = { y: number; first: number; last: number }

const rootOf = (parents: Int32Array, index: number): number =>
  parents[index] === index ? index : rootOf(parents, parents[index])

const join = (parents: Int32Array, first: number, second: number): void => {
  const firstRoot = rootOf(parents, first)
  const secondRoot = rootOf(parents, second)
  parents[Math.max(firstRoot, secondRoot)] = Math.min(firstRoot, secondRoot)
}

const touches = (upper: RowRun, lower: RowRun): boolean =>
  upper.y === lower.y - 1 && upper.first <= lower.last + 1 && lower.first <= upper.last + 1

const growBox = (box: InkComponent | undefined, run: RowRun): InkComponent =>
  box === undefined
    ? {
        left: run.first,
        right: run.last,
        top: run.y,
        bottom: run.y,
        pixelCount: run.last - run.first + 1
      }
    : {
        left: Math.min(box.left, run.first),
        right: Math.max(box.right, run.last),
        top: Math.min(box.top, run.y),
        bottom: Math.max(box.bottom, run.y),
        pixelCount: box.pixelCount + run.last - run.first + 1
      }

/**
 * The separate blobs of ink inside a region, each with its bounding box. Rows are cut into runs
 * first and runs that touch a run in the row above, diagonally included, are joined, so a page
 * of a few thousand symbols stays quick.
 * @param isInk - whether a pixel is ink
 * @param region - the part of the page to search, edges included
 * @returns the blobs in no particular order
 */
export const findComponents = (
  isInk: (x: number, y: number) => boolean,
  region: PixelBox
): InkComponent[] => {
  const rows = Array.from({ length: region.bottom - region.top + 1 }, (_, offset) => {
    const y = region.top + offset
    return runsAlong(region.right - region.left + 1, (index) => isInk(region.left + index, y)).map(
      ([first, last]): RowRun => ({ y, first: region.left + first, last: region.left + last })
    )
  })
  const runs = rows.flat()
  const parents = Int32Array.from(runs, (_, index) => index)
  const rowStarts = rows.reduce<number[]>(
    (starts, row, index) => [
      ...starts,
      index === 0 ? 0 : starts[index - 1] + rows[index - 1].length
    ],
    []
  )
  rows.forEach((row, rowIndex) =>
    row.forEach((run, runIndex) => {
      if (rowIndex === 0) {
        return
      }
      rows[rowIndex - 1].forEach((upper, upperIndex) => {
        if (touches(upper, run)) {
          join(parents, rowStarts[rowIndex - 1] + upperIndex, rowStarts[rowIndex] + runIndex)
        }
      })
    })
  )
  const boxes = runs.reduce((byRoot, run, index) => {
    const root = rootOf(parents, index)
    byRoot.set(root, growBox(byRoot.get(root), run))
    return byRoot
  }, new Map<number, InkComponent>())
  return [...boxes.values()]
}

const isNear = (first: PixelBox, second: PixelBox, margin: number): boolean =>
  first.left <= second.right + margin &&
  second.left <= first.right + margin &&
  first.top <= second.bottom + margin &&
  second.top <= first.bottom + margin

const mergeBoxes = (boxes: InkComponent[]): InkComponent => ({
  left: Math.min(...boxes.map((box) => box.left)),
  right: Math.max(...boxes.map((box) => box.right)),
  top: Math.min(...boxes.map((box) => box.top)),
  bottom: Math.max(...boxes.map((box) => box.bottom)),
  pixelCount: boxes.reduce((total, box) => total + box.pixelCount, 0)
})

/**
 * Joins blobs whose boxes come within a margin of each other. Taking out thin strokes can cut a
 * symbol in two, such as the dot and the tail of an eighth rest, and this puts it back together.
 * @param blobs - the blobs to join
 * @param margin - how close two boxes must come, in pixels
 * @returns the joined blobs
 */
export const mergeNearComponents = (blobs: InkComponent[], margin: number): InkComponent[] =>
  blobs.reduce<InkComponent[]>((merged, blob) => {
    const touching = merged.filter((group) => isNear(group, blob, margin))
    return touching.length === 0
      ? [...merged, blob]
      : [...merged.filter((group) => !touching.includes(group)), mergeBoxes([...touching, blob])]
  }, [])
