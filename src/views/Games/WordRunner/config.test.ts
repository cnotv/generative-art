import { describe, it, expect } from 'vitest'
import { CONTROL_MAPPING } from './config'

describe('CONTROL_MAPPING', () => {
  it.each([
    ['cross', 'brake'],
    ['circle', 'accelerate']
  ])('maps the gamepad %s button to %s', (button, action) => {
    // Act
    const mapped = CONTROL_MAPPING.gamepad?.[button]

    // Assert
    expect(mapped).toBe(action)
  })
})
