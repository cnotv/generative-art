import type { TimelineSection } from '../types'

/**
 * Splits a song into rows for the timeline. Each row starts on the last cycle of the one before
 * it, so a variation that crosses a row boundary can be picked whole from either row.
 * @param songCycles - how many cycles the song lasts
 * @param availableWidthPixels - the width the timeline has
 * @param minimumCycleWidthPixels - the narrowest a cycle may be drawn
 * @returns the sections in order, together covering every cycle
 */
export const splitTimelineSections = (
  songCycles: number,
  availableWidthPixels: number,
  minimumCycleWidthPixels: number
): TimelineSection[] => {
  const cyclesPerSection = Math.max(2, Math.floor(availableWidthPixels / minimumCycleWidthPixels))
  if (songCycles <= cyclesPerSection) {
    return [{ startCycle: 0, endCycle: songCycles }]
  }
  const cycleStep = cyclesPerSection - 1
  const sectionCount = Math.ceil((songCycles - 1) / cycleStep)
  return Array.from({ length: sectionCount }, (_, sectionIndex) => ({
    startCycle: sectionIndex * cycleStep,
    endCycle: Math.min(songCycles, sectionIndex * cycleStep + cyclesPerSection)
  }))
}

/**
 * Which section holds the playhead. In an overlap it is the later section, so the playhead
 * moves forward into the next row instead of lingering on the one it is leaving.
 * @param sections - the sections of the song
 * @param playheadCycle - where the playhead is, in cycles
 * @returns the index of the section the playhead sits in
 */
export const findSectionIndexForCycle = (
  sections: TimelineSection[],
  playheadCycle: number
): number => {
  const laterFirstIndex = sections.findLastIndex((section) => section.startCycle <= playheadCycle)
  return Math.max(0, laterFirstIndex)
}
