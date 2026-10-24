import { describe, it, expect } from 'vitest'
import type { EditorView, Rect } from '@codemirror/view'
import { positionCompletionInfo } from './positionCompletionInfo'

const box = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  right: left + width,
  bottom: top + height
})

const unusedView = {} as EditorView

describe('positionCompletionInfo', () => {
  it.each([
    {
      name: 'beside the list on the right, up to 800px, where there is room',
      list: box(100, 100, 350, 200),
      space: box(0, 0, 1600, 900),
      expected: { style: 'top: 20px; max-width: 800px', class: 'cm-completionInfo-right' }
    },
    {
      name: 'beside the list on the right, as wide as the room left',
      list: box(100, 100, 350, 200),
      space: box(0, 0, 1050, 900),
      expected: { style: 'top: 20px; max-width: 600px', class: 'cm-completionInfo-right' }
    },
    {
      name: 'on the left when the right has less room',
      list: box(900, 100, 350, 200),
      space: box(0, 0, 1300, 900),
      expected: { style: 'top: 20px; max-width: 800px', class: 'cm-completionInfo-left' }
    },
    {
      name: 'under the list when neither side has room',
      list: box(20, 100, 350, 200),
      space: box(0, 0, 400, 900),
      expected: { style: 'top: 40px; max-width: 350px', class: 'cm-completionInfo-right-narrow' }
    }
  ])('places the documentation $name', ({ list, space, expected }) => {
    // Arrange
    const option = box(list.left, 120, 350, 20)
    const info = box(0, 0, 400, 150)

    // Act
    const position = positionCompletionInfo(unusedView, list, option, info, space)

    // Assert
    expect(position).toEqual(expected)
  })
})
