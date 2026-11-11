import { describe, it, expect } from 'vitest'
import { randomUuidFromRandomValues } from './polyfillRandomUuid'

describe('randomUuidFromRandomValues', () => {
  it('returns a version 4 uuid', () => {
    expect(randomUuidFromRandomValues()).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/
    )
  })

  it('returns a different value each call', () => {
    expect(randomUuidFromRandomValues()).not.toBe(randomUuidFromRandomValues())
  })
})
