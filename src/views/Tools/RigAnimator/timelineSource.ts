import type { Timeline } from '@webgamekit/animation'
import type { TimelinePanelSource } from '@/stores/timelinePanel'

/** One lane per pose keyframe, shown as a short bar at its frame on the shared Timeline panel. */
export const buildKeyframeTimeline = (keyframeFrames: number[]): Timeline[] =>
  keyframeFrames.map((frame) => ({
    id: `keyframe-${frame}`,
    name: `Pose @ frame ${frame}`,
    category: 'pose-keyframe',
    start: frame,
    duration: 1
  }))

/**
 * Build the TimelinePanelSource the rig animator registers, so its pose keyframes appear on
 * the same Timeline panel every other view's frame-based scheduling does, rather than a
 * bespoke scrubber. A pose keyframe has no on/off state the way a timeline action does, so
 * the panel's per-row enable toggle is a no-op here.
 * @param getKeyframeFrames Every frame a pose keyframe currently exists at
 * @param getCurrentFrame The panel's live playhead position
 * @param getFps Frames per second, converted to the panel's seconds-per-frame rate
 */
export const buildRigTimelineSource = (
  getKeyframeFrames: () => number[],
  getCurrentFrame: () => number,
  getFps: () => number
): TimelinePanelSource => ({
  getTimeline: () => buildKeyframeTimeline(getKeyframeFrames()),
  getCurrentFrame,
  getFrameRate: () => 1 / getFps(),
  setActionEnabled: () => {}
})
