import { describe, it, expect } from 'vitest'
import {
  PHYSIC_BALLS,
  BALL_TYPE_LABELS,
  MARBLE_BALL_LABEL,
  findPresetByLabel,
  pickBallType,
  mergeBallOptions
} from './physicBalls'
import type { PhysicBallPreset } from '@/types/physicBalls'

const preset = (over: Partial<PhysicBallPreset> = {}): PhysicBallPreset => ({
  id: 'x',
  label: 'X',
  kind: 'ball',
  options: { size: 4, weight: 10 },
  editor: { size: 0.9, scale: [2, 2, 2] },
  ...over
})

describe('catalog', () => {
  it('lists the marble plus all six physic balls as selectable types', () => {
    expect(PHYSIC_BALLS).toHaveLength(6)
    expect(BALL_TYPE_LABELS).toHaveLength(7)
    expect(BALL_TYPE_LABELS[0]).toBe(MARBLE_BALL_LABEL)
  })

  it('resolves a preset by label and returns undefined for the marble', () => {
    expect(findPresetByLabel('Bowling')?.id).toBe('bowling')
    expect(findPresetByLabel(MARBLE_BALL_LABEL)).toBeUndefined()
    expect(findPresetByLabel('Nope')).toBeUndefined()
  })
})

describe('pickBallType', () => {
  it('returns the selected label when randomType is off', () => {
    expect(pickBallType(BALL_TYPE_LABELS, 'Tennis', false, () => 0.99)).toBe('Tennis')
  })

  it('returns a random label from the list when randomType is on', () => {
    expect(pickBallType(['A', 'B', 'C', 'D'], 'A', true, () => 0.5)).toBe('C')
    expect(pickBallType(['A', 'B', 'C', 'D'], 'A', true, () => 0)).toBe('A')
  })
})

describe('mergeBallOptions', () => {
  const position: [number, number, number] = [1, 2, 3]

  it('keeps original size/scale and sets position when editor scale is off', () => {
    const merged = mergeBallOptions(preset(), position, false)
    expect(merged.size).toBe(4)
    expect(merged.position).toEqual(position)
    expect(merged.scale).toBeUndefined()
  })

  it('applies marble-scale size and scale overrides when editor scale is on', () => {
    const merged = mergeBallOptions(preset(), position, true)
    expect(merged.size).toBe(0.9)
    expect(merged.scale).toEqual([2, 2, 2])
    expect(merged.position).toEqual(position)
  })

  it('leaves options unchanged when a preset has no editor overrides', () => {
    const merged = mergeBallOptions(preset({ editor: undefined }), position, true)
    expect(merged.size).toBe(4)
  })

  it('does not mutate the preset options', () => {
    const p = preset()
    mergeBallOptions(p, position, true)
    expect(p.options.size).toBe(4)
    expect(p.options.position).toBeUndefined()
  })
})
