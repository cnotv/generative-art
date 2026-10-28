import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { DEFAULT_CPS, STRUDEL_TIMELINE_MAX_LOOP_BARS } from '../config'
import type { StrudelEditorStatus, StrudelPlayback } from '../types'
import { useStrudelTimeline } from './useStrudelTimeline'

const buildPlayback = (cycle = 0, loopBars: number | null = 4): StrudelPlayback => ({
  evaluateCode: vi.fn(async () => ({ success: true })),
  stopPlayback: vi.fn(async () => {}),
  renderToWav: vi.fn(async () => ({ success: true })),
  renderToMidi: vi.fn(async () => ({ success: true })),
  measureRepetition: vi.fn(async () => 1),
  readPosition: vi.fn(() => ({ cycle, cyclesPerSecond: 0.75 })),
  seekToCycle: vi.fn(),
  measureLoop: vi.fn(() => loopBars)
})

const buildTimeline = (playback: StrudelPlayback | null, status: StrudelEditorStatus = 'idle') => {
  const editorStatus = ref<StrudelEditorStatus>(status)
  const frameCallbacks: (() => void)[] = []
  const timeline = useStrudelTimeline({
    editorStatus,
    getPlayback: () => playback,
    requestFrame: (callback) => frameCallbacks.push(callback),
    cancelFrame: vi.fn()
  })
  const runFrame = (): void => frameCallbacks.shift()?.()
  return { editorStatus, timeline, runFrame }
}

describe('useStrudelTimeline', () => {
  it('opens at the first bar over the longest window, before any loop is measured', () => {
    // Act
    const { timeline } = buildTimeline(null)

    // Assert
    expect(timeline.startCycle.value).toBe(0)
    expect(timeline.playheadCycle.value).toBe(0)
    expect(timeline.loopMeasured.value).toBe(false)
    expect(timeline.timelineBars.value).toBe(STRUDEL_TIMELINE_MAX_LOOP_BARS)
    expect(timeline.cyclesPerSecond.value).toBe(DEFAULT_CPS)
  })

  it('moves where the next Play starts when seeking while stopped', () => {
    // Arrange
    const playback = buildPlayback()
    const { timeline } = buildTimeline(playback)

    // Act
    timeline.seekToCycle(2.5)

    // Assert
    expect(timeline.startCycle.value).toBe(2.5)
    expect(timeline.playheadCycle.value).toBe(2.5)
    expect(playback.seekToCycle).not.toHaveBeenCalled()
  })

  it('moves the playing scheduler when seeking while playing', () => {
    // Arrange
    const playback = buildPlayback()
    const { timeline } = buildTimeline(playback, 'playing')

    // Act
    timeline.seekToCycle(3)

    // Assert
    expect(playback.seekToCycle).toHaveBeenCalledWith(3)
    expect(timeline.playheadCycle.value).toBe(3)
  })

  it.each([
    ['stopped, so Play starts at the picked cycle', 'idle' as const, [[1.5]]],
    ['playing, so an Update keeps the current position', 'playing' as const, []]
  ])('applies the start cycle when %s', (_, status, expectedCalls) => {
    // Arrange
    const playback = buildPlayback()
    const { timeline } = buildTimeline(playback, status)
    timeline.seekToCycle(1.5)
    vi.mocked(playback.seekToCycle).mockClear()

    // Act
    timeline.applyStartCycle()

    // Assert
    expect(vi.mocked(playback.seekToCycle).mock.calls).toEqual(expectedCalls)
  })

  it('reads the loop and the tempo of the pattern that started playing', () => {
    // Arrange
    const playback = buildPlayback(0, 3)
    const { timeline } = buildTimeline(playback, 'playing')

    // Act
    timeline.measurePlayedPattern()

    // Assert
    expect(timeline.loopMeasured.value).toBe(true)
    expect(timeline.loopBars.value).toBe(3)
    expect(timeline.timelineBars.value).toBe(3)
    expect(timeline.cyclesPerSecond.value).toBe(0.75)
  })

  it('keeps the longest window when the pattern does not repeat inside it', () => {
    // Arrange
    const playback = buildPlayback(0, null)
    const { timeline } = buildTimeline(playback, 'playing')

    // Act
    timeline.measurePlayedPattern()

    // Assert
    expect(timeline.loopMeasured.value).toBe(true)
    expect(timeline.loopBars.value).toBeNull()
    expect(timeline.timelineBars.value).toBe(STRUDEL_TIMELINE_MAX_LOOP_BARS)
  })

  it('follows playback each frame, wrapped into the loop', async () => {
    // Arrange
    const playback = buildPlayback(9.5, 4)
    const { timeline, editorStatus, runFrame } = buildTimeline(playback)
    editorStatus.value = 'playing'
    timeline.measurePlayedPattern()
    await nextTick()

    // Act
    runFrame()

    // Assert
    expect(timeline.playheadCycle.value).toBe(1.5)
  })

  it('holds the playing position as the start, so a pause resumes where it left off', () => {
    // Arrange
    const playback = buildPlayback(6.5, 4)
    const { timeline } = buildTimeline(playback, 'playing')
    timeline.measurePlayedPattern()

    // Act
    timeline.holdPlayingPosition()

    // Assert
    expect(timeline.startCycle.value).toBe(6.5)
    expect(timeline.playheadCycle.value).toBe(2.5)
  })

  it('returns the playhead to the start cycle when playback stops', async () => {
    // Arrange
    const playback = buildPlayback(2.25, 4)
    const { timeline, editorStatus, runFrame } = buildTimeline(playback)
    timeline.seekToCycle(1)
    editorStatus.value = 'playing'
    await nextTick()
    runFrame()

    // Act
    editorStatus.value = 'idle'
    await nextTick()

    // Assert
    expect(timeline.playheadCycle.value).toBe(1)
  })
})
