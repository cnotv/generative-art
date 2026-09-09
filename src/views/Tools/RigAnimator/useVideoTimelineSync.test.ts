import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useVideoTimelineSync } from './useVideoTimelineSync'

const FPS = 30

const createVideoElement = (initialTime: number) => {
  const state = { currentTime: initialTime }
  const setCurrentTime = vi.fn((value: number) => {
    state.currentTime = value
  })
  const video = {} as HTMLVideoElement
  Object.defineProperty(video, 'currentTime', {
    get: () => state.currentTime,
    set: setCurrentTime
  })
  return { video, setCurrentTime }
}

const buildSync = (initialVideoTime: number) => {
  const { video, setCurrentTime } = createVideoElement(initialVideoTime)
  const videoElement = ref<HTMLVideoElement | null>(video)
  const frame = ref(0)
  const mode = ref<'video' | 'camera'>('video')
  const recording = ref(false)
  const sync = useVideoTimelineSync({
    videoElement,
    frame: () => frame.value,
    fps: () => FPS,
    isVideoMode: () => mode.value === 'video',
    isRecording: () => recording.value
  })
  return { video, setCurrentTime, videoElement, frame, mode, recording, ...sync }
}

describe('useVideoTimelineSync', () => {
  describe('timeline frame drives the video', () => {
    it('seeks the video to the frame time when sync is on, in video mode, and not recording', async () => {
      const { setCurrentTime, frame } = buildSync(0)

      frame.value = 15
      await nextTick()

      expect(setCurrentTime).toHaveBeenCalledWith(15 / FPS)
    })

    it('does nothing when sync is disabled', async () => {
      const { setCurrentTime, frame, syncEnabled } = buildSync(0)
      syncEnabled.value = false

      frame.value = 15
      await nextTick()

      expect(setCurrentTime).not.toHaveBeenCalled()
    })

    it('does nothing outside video mode', async () => {
      const { setCurrentTime, frame, mode } = buildSync(0)
      mode.value = 'camera'

      frame.value = 15
      await nextTick()

      expect(setCurrentTime).not.toHaveBeenCalled()
    })

    it('does nothing while recording', async () => {
      const { setCurrentTime, frame, recording } = buildSync(0)
      recording.value = true

      frame.value = 15
      await nextTick()

      expect(setCurrentTime).not.toHaveBeenCalled()
    })

    it('does not re-seek when the video is already within half a frame of the target', async () => {
      const { setCurrentTime, frame } = buildSync(15 / FPS)

      frame.value = 15
      await nextTick()

      expect(setCurrentTime).not.toHaveBeenCalled()
    })
  })

  describe('the video drives the timeline back, via handleVideoSeeked', () => {
    it('returns the frame matching the video current time on a manual seek', () => {
      const { video, handleVideoSeeked } = buildSync(0)
      video.currentTime = 45 / FPS

      expect(handleVideoSeeked()).toBe(45)
    })

    it('returns null and consumes the echo right after a timeline-driven seek', async () => {
      const { frame, handleVideoSeeked } = buildSync(0)
      frame.value = 15
      await nextTick()

      expect(handleVideoSeeked()).toBeNull()
      // The echo is consumed once: a second, independent seek is reported normally.
      expect(handleVideoSeeked()).not.toBeNull()
    })

    it('returns null when sync is disabled', () => {
      const { syncEnabled, handleVideoSeeked } = buildSync(0)
      syncEnabled.value = false

      expect(handleVideoSeeked()).toBeNull()
    })

    it('returns null outside video mode', () => {
      const { mode, handleVideoSeeked } = buildSync(0)
      mode.value = 'camera'

      expect(handleVideoSeeked()).toBeNull()
    })

    it('returns null while recording', () => {
      const { recording, handleVideoSeeked } = buildSync(0)
      recording.value = true

      expect(handleVideoSeeked()).toBeNull()
    })
  })
})
