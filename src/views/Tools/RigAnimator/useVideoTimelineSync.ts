import { ref, watch, type Ref } from 'vue'

interface Dependencies {
  videoElement: Ref<HTMLVideoElement | null>
  /** The rig timeline's current frame, read fresh on every change rather than passed once. */
  frame: () => number
  fps: () => number
  /** Whether the uploaded video is the active source right now; sync only ever applies then. */
  isVideoMode: () => boolean
  /** Recording drives the timeline from the capture itself, not from playback or a scrub, so
   * sync is suspended while it runs rather than fighting the frames it is producing. */
  isRecording: () => boolean
}

/**
 * Keeps the rig timeline's frame and an uploaded video's playback position in sync while
 * `syncEnabled` is on: scrubbing the timeline seeks the video, and seeking the video (via its
 * own native controls) moves the timeline. `syncEnabled` defaults on, since the whole point of
 * uploading a video is to compare it against the rig, and unsynced playback needs the person to
 * opt out rather than in.
 */
export const useVideoTimelineSync = ({
  videoElement,
  frame,
  fps,
  isVideoMode,
  isRecording
}: Dependencies) => {
  const syncEnabled = ref(true)
  /** Set while a timeline-driven seek is in flight, so the native `seeked` event it causes is
   * recognised as an echo of that seek rather than a fresh manual scrub, and doesn't loop
   * straight back into another timeline update. */
  let isSeekingFromFrame = false

  watch(frame, (nextFrame) => {
    if (!syncEnabled.value || !isVideoMode() || isRecording()) return
    const video = videoElement.value
    if (!video) return
    const targetTime = nextFrame / fps()
    // Already there (within half a frame): the video's own `timeupdate` advanced it past this
    // exact frame between this and the last sync, and re-seeking to the same instant would
    // still fire a spurious `seeked` echo.
    if (Math.abs(video.currentTime - targetTime) < 1 / fps() / 2) return
    isSeekingFromFrame = true
    video.currentTime = targetTime
  })

  /** Call from the video element's native `seeked` event. Returns the timeline frame to move to,
   * or `null` when the seek was either the sync's own echo or sync does not apply right now. */
  const handleVideoSeeked = (): number | null => {
    if (isSeekingFromFrame) {
      isSeekingFromFrame = false
      return null
    }
    if (!syncEnabled.value || !isVideoMode() || isRecording()) return null
    const video = videoElement.value
    if (!video) return null
    return Math.round(video.currentTime * fps())
  }

  return { syncEnabled, handleVideoSeeked }
}
