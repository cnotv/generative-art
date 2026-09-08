import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useRigMotionRecording } from './useRigMotionRecording'

describe('useRigMotionRecording', () => {
  let nowMs = 0

  beforeEach(() => {
    nowMs = 0
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const buildRecorder = (fps = 30, frameMax = 150) => {
    const frame = { value: 0 }
    const frameMaxState = { value: frameMax }
    const addKeyframeCalls: number[] = []
    const recorder = useRigMotionRecording({
      fps: () => fps,
      currentFrame: () => frame.value,
      frameMax: () => frameMaxState.value,
      setFrame: (next) => (frame.value = next),
      setFrameMax: (next) => (frameMaxState.value = next),
      addKeyframe: () => addKeyframeCalls.push(frame.value)
    })
    return { recorder, frame, frameMaxState, addKeyframeCalls }
  }

  it('does nothing while not recording', () => {
    const { recorder, frame, addKeyframeCalls } = buildRecorder()

    nowMs = 1000
    recorder.recordFrameIfActive()

    expect(frame.value).toBe(0)
    expect(addKeyframeCalls).toEqual([])
  })

  it('captures the anchor frame itself the instant recording starts', () => {
    const { recorder, addKeyframeCalls } = buildRecorder(30)

    recorder.startRecording()

    // recordFrameIfActive's own guard never captures this frame later (it only fires once
    // real time reaches a frame strictly past it), so without this the take's start would be
    // left holding whatever pose, if any, already sat there.
    expect(addKeyframeCalls).toEqual([0])
    expect(recorder.capturedFrameCount.value).toBe(0)
  })

  it('samples a keyframe once real elapsed time reaches a new frame at the configured fps', () => {
    const { recorder, frame, addKeyframeCalls } = buildRecorder(30)
    recorder.startRecording()

    // Under half a frame's worth of time at 30fps: still frame 0, nothing further recorded.
    nowMs = 10
    recorder.recordFrameIfActive()
    expect(frame.value).toBe(0)
    expect(addKeyframeCalls).toEqual([0])

    // Exactly two frames in: advances the playhead and captures the pose there.
    nowMs = (2 * 1000) / 30
    recorder.recordFrameIfActive()
    expect(frame.value).toBe(2)
    expect(addKeyframeCalls).toEqual([0, 2])
    expect(recorder.capturedFrameCount.value).toBe(1)
  })

  it('never re-captures the same frame twice for calls that land within it', () => {
    const { recorder, addKeyframeCalls } = buildRecorder(30)
    recorder.startRecording()

    nowMs = 1000 / 30
    recorder.recordFrameIfActive()
    recorder.recordFrameIfActive()

    expect(addKeyframeCalls).toEqual([0, 1])
  })

  it('grows the visible frame range rather than dropping frames past it', () => {
    const { recorder, frame, frameMaxState } = buildRecorder(30, 10)
    recorder.startRecording()

    nowMs = (20 * 1000) / 30
    recorder.recordFrameIfActive()

    expect(frame.value).toBe(20)
    expect(frameMaxState.value).toBe(20)
  })

  it('anchors to whatever frame the playhead already sat on when recording started', () => {
    const { recorder, frame, addKeyframeCalls } = buildRecorder(30)
    frame.value = 5

    recorder.startRecording()
    nowMs = 1000 / 30
    recorder.recordFrameIfActive()

    expect(frame.value).toBe(6)
    expect(addKeyframeCalls).toEqual([5, 6])
  })

  it('stops sampling once stopped', () => {
    const { recorder, frame, addKeyframeCalls } = buildRecorder(30)
    recorder.startRecording()
    recorder.stopRecording()

    nowMs = 1000
    recorder.recordFrameIfActive()

    expect(frame.value).toBe(0)
    expect(addKeyframeCalls).toEqual([0])
  })
})
