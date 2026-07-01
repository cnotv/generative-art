import { describe, it, expect } from 'vitest'
import { assignBinding, removeBinding, createDefaultMapping } from './mapping'
import type { ControlMapping } from './types'

describe('assignBinding', () => {
  it('sets a trigger to an action for a device without mutating the input', () => {
    const mapping: ControlMapping = { keyboard: { w: 'move-forward' } }

    const next = assignBinding(mapping, 'keyboard', 'ArrowUp', 'move-forward')

    expect(next.keyboard).toEqual({ ArrowUp: 'move-forward' })
    expect(mapping.keyboard).toEqual({ w: 'move-forward' })
  })

  it('removes any other trigger already bound to the same action on that device', () => {
    const mapping: ControlMapping = { keyboard: { w: 'move-forward', s: 'move-back' } }

    const next = assignBinding(mapping, 'keyboard', 'ArrowUp', 'move-forward')

    expect(next.keyboard).toEqual({ ArrowUp: 'move-forward', s: 'move-back' })
  })

  it('leaves other devices untouched', () => {
    const mapping: ControlMapping = {
      keyboard: { w: 'move-forward' },
      gamepad: { 'dpad-up': 'move-forward' }
    }

    const next = assignBinding(mapping, 'keyboard', 'ArrowUp', 'move-forward')

    expect(next.gamepad).toEqual({ 'dpad-up': 'move-forward' })
  })
})

describe('removeBinding', () => {
  it('removes a trigger without mutating the input', () => {
    const mapping: ControlMapping = { keyboard: { w: 'move-forward', s: 'move-back' } }

    const next = removeBinding(mapping, 'keyboard', 'w')

    expect(next.keyboard).toEqual({ s: 'move-back' })
    expect(mapping.keyboard).toEqual({ w: 'move-forward', s: 'move-back' })
  })

  it('is a no-op when the trigger is absent', () => {
    const mapping: ControlMapping = { keyboard: { w: 'move-forward' } }

    const next = removeBinding(mapping, 'keyboard', 'missing')

    expect(next.keyboard).toEqual({ w: 'move-forward' })
  })
})

describe('createDefaultMapping', () => {
  it('provides keyboard, gamepad and faux-pad bindings', () => {
    const mapping = createDefaultMapping()

    expect(Object.values(mapping.keyboard ?? {})).toContain('move-forward')
    expect(Object.values(mapping.gamepad ?? {})).toContain('move-forward')
    expect(Object.keys(mapping['faux-pad'] ?? {})).toEqual(
      expect.arrayContaining(['up', 'down', 'left', 'right'])
    )
  })

  it('returns a fresh object each call', () => {
    expect(createDefaultMapping()).not.toBe(createDefaultMapping())
  })
})
