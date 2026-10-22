import { describe, it, expect } from 'vitest'
import { toViewportRect } from './avatarStage'

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
