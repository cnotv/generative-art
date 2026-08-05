import { describe, it, expect } from 'vitest'
import { getPixelRatio } from './getters'

describe('getPixelRatio', () => {
  it.each([
    [1, 1],
    [2, 2]
  ])('leaves a device pixel ratio of %f at %f', (device, expected) => {
    expect(getPixelRatio(device)).toBe(expected)
  })

  it.each([
    [3, 2],
    [4, 2]
  ])('caps a device pixel ratio of %f down to %f', (device, expected) => {
    expect(getPixelRatio(device)).toBe(expected)
  })

  it('respects a custom maximum', () => {
    expect(getPixelRatio(3, 1.5)).toBe(1.5)
  })
})
