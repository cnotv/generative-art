import { describe, expect, it } from 'vitest'
import { readStrudelFlowCallFields, writeStrudelFlowCallFields } from './callArguments'

describe('readStrudelFlowCallFields', () => {
  it.each([
    [
      { method: 'sometimesBy', argument: '.2, (x) => x.ply(2)' },
      [
        { kind: 'number', label: 'Chance', min: 0, max: 1, step: 0.01, value: 0.2 },
        { kind: 'text', label: 'Then', value: '(x) => x.ply(2)' }
      ]
    ],
    [
      { method: 'swingBy', argument: '1/3, 4' },
      [
        { kind: 'number', label: 'Swing', min: 0, max: 0.5, step: 0.01, value: 1 / 3 },
        { kind: 'number', label: 'Subdivision', min: 1, max: 16, step: 1, value: 4 }
      ]
    ],
    [
      { method: 'mask', argument: '"<1 1 1 0>"' },
      [{ kind: 'toggles', label: 'Plays', steps: [true, true, true, false], perCycle: true }]
    ],
    [
      { method: 'mask', argument: '"1 0 1 1"' },
      [{ kind: 'toggles', label: 'Plays', steps: [true, false, true, true], perCycle: false }]
    ]
  ])('reads %o into its controls', (call, fields) => {
    // Arrange / Act
    const readFields = readStrudelFlowCallFields(call)

    // Assert
    expect(readFields).toEqual(fields)
  })

  it.each([
    ['a call it has no controls for', { method: 'jux', argument: 'rev' }],
    ['a pattern where a number goes', { method: 'fast', argument: '"<1 2>"' }],
    ['too few arguments', { method: 'swingBy', argument: '1/3' }],
    ['a mask longer than the strip can show', { method: 'mask', argument: `"<1!65>"` }],
    ['a mask that is not ones and zeros', { method: 'mask', argument: '"<1 [0 1]>"' }]
  ])('keeps %s as written', (_case, call) => {
    // Arrange / Act
    const readFields = readStrudelFlowCallFields(call)

    // Assert
    expect(readFields).toBeNull()
  })
})

describe('repeated mask steps', () => {
  it('reads 1!40 as forty cycles and writes runs back with the same repeats', () => {
    // Arrange
    const [field] = readStrudelFlowCallFields({ method: 'mask', argument: '"<1!40 0!8 1!16>"' })!

    // Act
    const argument = writeStrudelFlowCallFields([field])

    // Assert
    expect(field).toMatchObject({ kind: 'toggles', perCycle: true, repeated: true })
    expect(field.kind === 'toggles' && field.steps).toHaveLength(64)
    expect(argument).toBe('"<1!40 0!8 1!16>"')
  })

  it('writes a toggled cycle as its own run', () => {
    // Arrange
    const [field] = readStrudelFlowCallFields({ method: 'mask', argument: '"<1!4 0>"' })!
    const toggled = { ...field, steps: [true, false, true, true, false] } as typeof field

    // Act
    const argument = writeStrudelFlowCallFields([toggled])

    // Assert
    expect(argument).toBe('"<1 0 1!2 0>"')
  })
})

describe('writeStrudelFlowCallFields', () => {
  it('writes the controls back as the call argument', () => {
    // Arrange
    const fields = [
      ...readStrudelFlowCallFields({ method: 'sometimesBy', argument: '.2, (x) => x.ply(2)' })!,
      ...readStrudelFlowCallFields({ method: 'mask', argument: '"<1 1 1 0>"' })!
    ]

    // Act
    const argument = writeStrudelFlowCallFields(fields)

    // Assert
    expect(argument).toBe('0.2, (x) => x.ply(2), "<1 1 1 0>"')
  })
})
