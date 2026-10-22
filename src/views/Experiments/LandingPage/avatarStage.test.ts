import { describe, it, expect } from 'vitest'
import { toViewportRect, getAvatarSwing } from './avatarStage'
import { AVATAR_SWING } from './config'

describe('toViewportRect', () => {
  it('measures the element from the canvas bottom-left corner', () => {
    // Arrange
    const canvas = new DOMRectReadOnly(100, 200, 400, 300)
    const element = new DOMRectReadOnly(150, 260, 80, 80)

    // Act
    const viewport = toViewportRect(element, canvas)

    // Assert
    expect(viewport).toEqual({ x: 50, y: 160, width: 80, height: 80 })
  })
})

describe('getAvatarSwing', () => {
  it('stays within the swing and starts each avatar at a different point', () => {
    // Act
    const swings = [0, 1, 2].map((index) => getAvatarSwing(0, index))

    // Assert
    swings.forEach((swing) => expect(Math.abs(swing)).toBeLessThanOrEqual(AVATAR_SWING))
    expect(new Set(swings).size).toBe(3)
  })
})
