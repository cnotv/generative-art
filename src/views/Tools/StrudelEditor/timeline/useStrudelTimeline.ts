import { computed, onScopeDispose, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { DEFAULT_CPS, STRUDEL_MAX_SONG_CYCLES } from '../config'
import type { StrudelEditorStatus, StrudelPlayback } from '../types'

type StrudelTimelineHooks = {
  editorStatus: Ref<StrudelEditorStatus>
  /** The loaded playback, or null before the first Play loads the engine. */
  getPlayback: () => StrudelPlayback | null
  /** Called once when playback reaches the end of the song while looping is off; the timeline then rewinds. */
  onSongEnd: () => void
  requestFrame?: (callback: () => void) => number
  cancelFrame?: (frameHandle: number) => void
}

type StrudelTimelineState = {
  /** Where the next Play starts, in cycles; one cycle is one bar. */
  startCycle: Ref<number>
  /** Where the playhead sits inside the timeline, in cycles. */
  playheadCycle: Ref<number>
  cyclesPerSecond: Ref<number>
  /** Whether playback wraps at the end of the song; off plays it once, then ends. */
  loopEnabled: Ref<boolean>
  /** Bars the played pattern takes to repeat, or null when it does not within the limit. */
  loopBars: Ref<number | null>
  /** False until a pattern has played, since only an evaluated pattern can be measured. */
  loopMeasured: Ref<boolean>
  /** How many cycles the song lasts: the loop, or the song limit when there is none. */
  timelineBars: ComputedRef<number>
  seekToCycle: (cycle: number) => void
  /** Puts the next Play and the playhead back on the first cycle. */
  rewind: () => void
  /** Moves a stopped scheduler to the start cycle, just before Play evaluates. */
  applyStartCycle: () => void
  /** Reads the loop and tempo of the pattern that just started or updated. */
  measurePlayedPattern: () => void
  /** Makes where playback is now the start, so stopping there is a pause that Play resumes. */
  holdPlayingPosition: () => void
}

/**
 * The timeline under the editor: where Play starts, where the playhead is and how long the
 * pattern's loop is. Code and flow mode play the same compiled code through one scheduler, so
 * they share this one position rather than keep one each that could disagree with the sound.
 * @param hooks - the play state, the playback to seek, and frame scheduling for tests
 * @returns the timeline state and its actions
 */
export const useStrudelTimeline = (hooks: StrudelTimelineHooks): StrudelTimelineState => {
  const requestFrame = hooks.requestFrame ?? ((callback) => window.requestAnimationFrame(callback))
  const cancelFrame =
    hooks.cancelFrame ?? ((frameHandle) => window.cancelAnimationFrame(frameHandle))
  const startCycle = ref(0)
  const playheadCycle = ref(0)
  const cyclesPerSecond = ref(DEFAULT_CPS)
  const loopEnabled = ref(true)
  const loopBars = ref<number | null>(null)
  const loopMeasured = ref(false)
  const timelineBars = computed(() => loopBars.value ?? STRUDEL_MAX_SONG_CYCLES)
  let frameHandle: number | null = null
  let songEndReported = false

  const wrapIntoTimeline = (cycle: number): number => cycle % timelineBars.value

  const placeOnTimeline = (cycle: number): number =>
    loopEnabled.value ? wrapIntoTimeline(cycle) : Math.min(cycle, timelineBars.value)

  const rewind = (): void => {
    startCycle.value = 0
    playheadCycle.value = 0
  }

  const reportSongEndOnce = (cycle: number): void => {
    if (!loopEnabled.value && !songEndReported && cycle >= timelineBars.value) {
      songEndReported = true
      hooks.onSongEnd()
      rewind()
    }
  }

  const followPlayback = (): void => {
    const position = hooks.getPlayback()?.readPosition()
    if (position !== undefined) {
      playheadCycle.value = placeOnTimeline(position.cycle)
      cyclesPerSecond.value = position.cyclesPerSecond
      reportSongEndOnce(position.cycle)
    }
    frameHandle = requestFrame(followPlayback)
  }

  const stopFollowing = (): void => {
    if (frameHandle !== null) {
      cancelFrame(frameHandle)
    }
    frameHandle = null
  }

  watch(hooks.editorStatus, (status) => {
    stopFollowing()
    if (status === 'playing') {
      songEndReported = false
      frameHandle = requestFrame(followPlayback)
      return
    }
    playheadCycle.value = wrapIntoTimeline(startCycle.value)
  })
  onScopeDispose(stopFollowing)

  const seekToCycle = (cycle: number): void => {
    startCycle.value = cycle
    playheadCycle.value = wrapIntoTimeline(cycle)
    if (hooks.editorStatus.value === 'playing') {
      hooks.getPlayback()?.seekToCycle(cycle)
    }
  }

  const applyStartCycle = (): void => {
    if (hooks.editorStatus.value !== 'playing') {
      hooks.getPlayback()?.seekToCycle(startCycle.value)
    }
  }

  const measurePlayedPattern = (): void => {
    const playback = hooks.getPlayback()
    if (playback === null) {
      return
    }
    loopBars.value = playback.measureLoop()
    loopMeasured.value = true
    cyclesPerSecond.value = playback.readPosition().cyclesPerSecond
  }

  const holdPlayingPosition = (): void => {
    const position = hooks.getPlayback()?.readPosition()
    if (position !== undefined) {
      startCycle.value = position.cycle
      playheadCycle.value = wrapIntoTimeline(position.cycle)
    }
  }

  return {
    startCycle,
    playheadCycle,
    cyclesPerSecond,
    loopEnabled,
    loopBars,
    loopMeasured,
    timelineBars,
    seekToCycle,
    rewind,
    applyStartCycle,
    measurePlayedPattern,
    holdPlayingPosition
  }
}
