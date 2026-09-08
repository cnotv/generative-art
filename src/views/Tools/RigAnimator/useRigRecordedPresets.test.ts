import { describe, it, expect } from 'vitest'
import { useRigRecordedPresets } from './useRigRecordedPresets'
import type { PoseKeyframe } from '@webgamekit/rig'

describe('useRigRecordedPresets', () => {
  const keyframes: PoseKeyframe[] = [{ frame: 0, pose: {} }]

  it('starts with no recorded presets', () => {
    const { recordedPresets } = useRigRecordedPresets()

    expect(recordedPresets.value).toEqual([])
  })

  it('adds a preset named after how many takes have been recorded so far', () => {
    const { recordedPresets, addRecordedPreset } = useRigRecordedPresets()

    addRecordedPreset(keyframes)
    addRecordedPreset(keyframes)

    expect(recordedPresets.value.map((preset) => preset.name)).toEqual([
      'Recording 1',
      'Recording 2'
    ])
  })

  it('snapshots the given keyframes rather than keeping a live reference to them', () => {
    const { recordedPresets, addRecordedPreset } = useRigRecordedPresets()
    const mutableKeyframes: PoseKeyframe[] = [{ frame: 0, pose: {} }]

    addRecordedPreset(mutableKeyframes)
    mutableKeyframes.push({ frame: 1, pose: {} })

    expect(recordedPresets.value[0].keyframes).toHaveLength(1)
  })
})
