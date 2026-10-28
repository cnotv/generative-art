import type { StrudelFlowNoteBar, StrudelFlowNoteEvent } from './types'

/**
 * A bar's events in time order, each cut short where the next begins: Strudel can overlap two
 * notes that do not start together, and a staff plays one after the other.
 * @param bar - the bar's events
 * @returns the events in order, none overlapping
 */
export const sequenceStrudelFlowNoteBar = (bar: StrudelFlowNoteBar): StrudelFlowNoteEvent[] => {
  const sorted = bar.toSorted((first, second) => first.start - second.start)
  return sorted.map((event, index) => {
    const nextStart = sorted[index + 1]?.start ?? Infinity
    return { ...event, beats: Math.min(event.beats, nextStart - event.start) }
  })
}

/**
 * Splits a list into runs of neighbours that belong together.
 * @param items - the list, in order
 * @param joins - whether an item continues the run of the one before it
 * @returns the runs, in order
 */
export const groupStrudelFlowRuns = <Item>(
  items: Item[],
  joins: (previous: Item, item: Item) => boolean
): Item[][] =>
  items.reduce<Item[][]>((runs, item, index) => {
    const previous = items[index - 1]
    return previous !== undefined && joins(previous, item)
      ? [...runs.slice(0, -1), [...runs.at(-1)!, item]]
      : [...runs, [item]]
  }, [])
