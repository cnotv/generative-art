import type { Timeline, ComplexModel } from './types'

/**
 * Generate unique ID for timeline actions
 * @returns Unique identifier string
 */
export const generateTimelineId = (): string => {
  return `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create timeline action with duration
 * @param start Starting frame
 * @param duration Duration in frames
 * @param action Action callback
 * @param options Additional timeline options
 * @returns Timeline object with calculated end frame
 */
export const createDurationAction = (
  start: number,
  duration: number,
  action: (element?: unknown) => void,
  options?: Partial<Timeline>
): Timeline => ({
  start,
  duration,
  action,
  id: generateTimelineId(),
  ...options
})

/**
 * Create one-shot action that runs once then auto-removes
 * @param frame Frame to execute on
 * @param action Action callback
 * @param options Additional timeline options
 * @returns Timeline object with autoRemove enabled
 */
export const createOneShotAction = (
  frame: number,
  action: (element?: unknown) => void,
  options?: Partial<Timeline>
): Timeline => ({
  start: frame,
  end: frame,
  action,
  autoRemove: true,
  id: generateTimelineId(),
  ...options
})

/**
 * Create interval-based action with auto-naming
 * @param interval [length, pause] in frames
 * @param action Action callback
 * @param options Additional timeline options
 * @returns Timeline object with interval configuration
 */
export const createIntervalAction = (
  interval: [number, number],
  action: (element?: unknown) => void,
  options?: Partial<Timeline>
): Timeline => ({
  interval,
  action,
  id: generateTimelineId(),
  name: options?.name || `interval_${interval[0]}_${interval[1]}`,
  ...options
})

/**
 * Check if action can be added (not blocked by performing state)
 * @param player ComplexModel with animation actions
 * @param blocking Blocking duration in milliseconds
 * @returns True if action can be added, false if blocked
 */
export const canAddAction = (player: ComplexModel, blocking: number = 0): boolean => {
  const currentAction = player.userData.actions?.[player.userData.currentAction as string]
  if (!currentAction) return true
  return currentAction.time >= blocking
}

/**
 * Derive the frame range a timeline action occupies, from whichever time
 * properties it defines (`start`/`end`, `start`+`duration`, or `delay`+`interval`).
 * @param action Timeline action to inspect
 * @returns Frame range `{ start, end }`, defaulting to a zero-length span at frame 0
 */
export const getTimelineActionSpan = (action: Timeline): { start: number; end: number } => {
  const start = action.start ?? action.delay ?? 0
  if (action.duration !== undefined) return { start, end: start + action.duration }
  if (action.end !== undefined) return { start, end: action.end }
  if (action.interval) return { start, end: start + action.interval[0] }
  return { start, end: start }
}

/**
 * Frame spans for each repeating move of a cyclic action's `segments` within
 * [rangeStartFrame, rangeEndFrame]. The segments play back to back and the
 * whole sequence loops every `sum(segments.frames)` frames.
 * @param segments Per-cycle move breakdown (name + duration in frames)
 * @param rangeStartFrame Start of the visible frame range
 * @param rangeEndFrame End of the visible frame range
 * @returns Named frame spans for every segment occurrence overlapping the range
 */
export const getTimelineSegmentOccurrences = (
  segments: { name: string; frames: number }[],
  rangeStartFrame: number,
  rangeEndFrame: number
): { name: string; start: number; end: number }[] => {
  const cycle = segments.reduce<{ name: string; start: number; end: number }[]>(
    (accumulated, segment) => {
      const start = accumulated.length > 0 ? accumulated[accumulated.length - 1].end : 0
      return [...accumulated, { name: segment.name, start, end: start + segment.frames }]
    },
    []
  )
  const totalFrames = cycle.length > 0 ? cycle[cycle.length - 1].end : 0
  if (totalFrames <= 0) return []

  const firstCycle = Math.floor(rangeStartFrame / totalFrames) - 1
  const lastCycle = Math.ceil(rangeEndFrame / totalFrames)

  return Array.from(
    { length: Math.max(0, lastCycle - firstCycle + 1) },
    (_, index) => firstCycle + index
  )
    .flatMap((cycleIndex) =>
      cycle.map((segment) => ({
        name: segment.name,
        start: segment.start + cycleIndex * totalFrames,
        end: segment.end + cycleIndex * totalFrames
      }))
    )
    .filter(({ start, end }) => end > rangeStartFrame && start < rangeEndFrame)
}

/**
 * Span for a continuous action (no `end`, `duration` or `interval`), which runs
 * indefinitely from `start`. Yields a span covering the whole range from `start`
 * onward, or nothing if the action hasn't started by the end of the range.
 */
const getContinuousActionOccurrences = (
  action: Timeline,
  rangeStartFrame: number,
  rangeEndFrame: number
): { start: number; end: number }[] => {
  const start = action.start ?? action.delay ?? 0
  return start <= rangeEndFrame
    ? [{ start: Math.max(start, rangeStartFrame), end: rangeEndFrame }]
    : []
}

/** Span for a non-repeating, non-continuous action, if it overlaps the range. */
const getSingleActionOccurrences = (
  action: Timeline,
  rangeStartFrame: number,
  rangeEndFrame: number
): { start: number; end: number }[] => {
  const span = getTimelineActionSpan(action)
  return span.end >= rangeStartFrame && span.start <= rangeEndFrame ? [span] : []
}

/** Spans for every occurrence of a repeating (`interval`-based) action overlapping the range. */
const getIntervalActionOccurrences = (
  interval: [number, number],
  delay: number,
  rangeStartFrame: number,
  rangeEndFrame: number
): { start: number; end: number }[] => {
  const [length, pause] = interval
  const period = length + pause
  if (period <= 0) return []

  const firstOccurrence = Math.max(0, Math.ceil((rangeStartFrame - length - delay) / period))
  const lastOccurrence = Math.floor((rangeEndFrame - delay) / period)

  return Array.from({ length: Math.max(0, lastOccurrence - firstOccurrence + 1) }, (_, index) => {
    const start = delay + (firstOccurrence + index) * period
    return { start, end: start + length }
  }).filter(({ start, end }) => end >= rangeStartFrame && start <= rangeEndFrame)
}

/**
 * Frame spans for a single action within [rangeStartFrame, rangeEndFrame].
 * Repeating (`interval`-based) actions are expanded into one span per occurrence
 * that overlaps the range. An action with none of `end`, `duration` or `interval`
 * is treated as continuous (runs indefinitely from `start`), so it yields a span
 * covering the whole range from `start` onward.
 */
const getActionOccurrences = (
  action: Timeline,
  rangeStartFrame: number,
  rangeEndFrame: number
): { start: number; end: number }[] => {
  if (action.interval) {
    const delay = action.delay ?? action.start ?? 0
    return getIntervalActionOccurrences(action.interval, delay, rangeStartFrame, rangeEndFrame)
  }
  if (action.end === undefined && action.duration === undefined) {
    return getContinuousActionOccurrences(action, rangeStartFrame, rangeEndFrame)
  }
  return getSingleActionOccurrences(action, rangeStartFrame, rangeEndFrame)
}

/** Number of cycling colors used for timeline chart bars (--timeline-color-0..N-1) */
const TIMELINE_CHART_COLOR_COUNT = 8

/** Minimum bar width as a percentage of the visible window, for readability */
const TIMELINE_CHART_MIN_BAR_WIDTH_PERCENT = 1

export interface TimelineChartBar {
  id: string
  name: string
  left: number
  width: number
  lane: number
  colorIndex: number
  action: Timeline
}

export interface TimelineChartRange {
  /** Start of the visible window, in seconds */
  rangeStart: number
  /** End of the visible window, in seconds */
  rangeEnd: number
  /** Seconds per frame */
  rate: number
}

/**
 * Lay out a timeline configuration as chart bars for a visible time window.
 * Each action becomes one bar per occurrence (repeated for `interval` actions
 * or expanded via `segments`), positioned and sized as percentages of the
 * window, with a minimum readable width that never overlaps the next
 * occurrence in the same lane.
 * @param timeline Ordered list of timeline actions (one lane per action)
 * @param range Visible window bounds and frame rate
 * @returns Chart bars ready to render
 */
export const getTimelineChartBars = (
  timeline: Timeline[],
  { rangeStart, rangeEnd, rate }: TimelineChartRange
): TimelineChartBar[] => {
  const window = rangeEnd - rangeStart
  const rangeStartFrame = rangeStart / rate
  const rangeEndFrame = rangeEnd / rate

  return timeline.flatMap((action, lane) => {
    const segments = action.segments
    const occurrences =
      segments && segments.length > 0
        ? getTimelineSegmentOccurrences(segments, rangeStartFrame, rangeEndFrame).map(
            (segment, occurrenceIndex) => ({
              name: segment.name,
              start: segment.start,
              end: segment.end,
              colorIndex: (lane + (occurrenceIndex % segments.length)) % TIMELINE_CHART_COLOR_COUNT
            })
          )
        : getActionOccurrences(action, rangeStartFrame, rangeEndFrame).map((span) => ({
            name: action.name ?? action.category ?? `Action ${lane + 1}`,
            start: span.start,
            end: span.end,
            colorIndex: lane % TIMELINE_CHART_COLOR_COUNT
          }))

    // Occurrences are in chronological order; clamp each bar's width so the minimum
    // readable size never overlaps into the space occupied by the next occurrence.
    const positioned = occurrences.map(({ name, start, end, colorIndex }, occurrenceIndex) => {
      const clippedStart = Math.max(start * rate, rangeStart)
      const clippedEnd = Math.max(Math.min(end * rate, rangeEnd), clippedStart)
      return {
        id: `${action.id ?? `action-${lane}`}-${occurrenceIndex}`,
        name,
        left: ((clippedStart - rangeStart) / window) * 100,
        naturalWidth: ((clippedEnd - clippedStart) / window) * 100,
        colorIndex
      }
    })

    return positioned.map(({ id, name, left, naturalWidth, colorIndex }, occurrenceIndex) => {
      const availableWidth = (positioned[occurrenceIndex + 1]?.left ?? 100) - left
      return {
        id,
        name,
        left,
        width: Math.min(
          Math.max(naturalWidth, TIMELINE_CHART_MIN_BAR_WIDTH_PERCENT),
          Math.max(availableWidth, 0)
        ),
        lane,
        colorIndex,
        action
      }
    })
  })
}
