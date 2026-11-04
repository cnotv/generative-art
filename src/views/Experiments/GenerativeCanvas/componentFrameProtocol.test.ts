import { describe, it, expect } from 'vitest'
import { parseFrameMessage, applyStatePatch } from './componentFrameProtocol'

describe('parseFrameMessage', () => {
  it.each([
    [{ type: 'ready' }, { type: 'ready' }],
    [{ type: 'mounted' }, { type: 'mounted' }],
    [
      { type: 'error', message: 'boom' },
      { type: 'error', message: 'boom' }
    ],
    [
      { type: 'update', patch: { count: 2, label: 'a', on: true } },
      { type: 'update', patch: { count: 2, label: 'a', on: true } }
    ]
  ])('accepts %j', (data, expected) => {
    // Act
    const message = parseFrameMessage(data)

    // Assert
    expect(message).toEqual(expected)
  })

  it.each([
    ['null', null],
    ['a string', 'ready'],
    ['an unknown type', { type: 'navigate', url: 'https://example.com' }],
    ['an error without a message', { type: 'error' }],
    ['an error with a non-string message', { type: 'error', message: { toString: 1 } }],
    ['an update without a patch', { type: 'update' }],
    ['an update with an array patch', { type: 'update', patch: [1, 2] }],
    ['an update with a nested object value', { type: 'update', patch: { count: { value: 1 } } }],
    ['an update with a function-like value', { type: 'update', patch: { count: null } }]
  ])('rejects %s', (_label, data) => {
    // Act
    const message = parseFrameMessage(data)

    // Assert
    expect(message).toBeNull()
  })

  it('drops extra keys from an accepted message', () => {
    // Act
    const message = parseFrameMessage({ type: 'error', message: 'boom', stack: 'secret' })

    // Assert
    expect(message).toEqual({ type: 'error', message: 'boom' })
  })
})

describe('applyStatePatch', () => {
  const state = { count: 1, label: 'start', enabled: false }

  it('applies keys that exist in the state with the same type', () => {
    // Act
    const nextState = applyStatePatch(state, { count: 5, enabled: true })

    // Assert
    expect(nextState).toEqual({ count: 5, label: 'start', enabled: true })
  })

  it.each([
    ['a key the state does not have', { injected: 1 }],
    ['a value of a different type', { count: '5' }],
    ['a prototype key', JSON.parse('{"__proto__": {"polluted": true}}')]
  ])('ignores %s', (_label, patch) => {
    // Act
    const nextState = applyStatePatch(state, patch)

    // Assert
    expect(nextState).toEqual(state)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('returns a new object and leaves the input untouched', () => {
    // Act
    const nextState = applyStatePatch(state, { count: 9 })

    // Assert
    expect(nextState).not.toBe(state)
    expect(state.count).toBe(1)
  })
})
