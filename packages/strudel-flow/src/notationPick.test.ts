import { describe, expect, it } from 'vitest'
import {
  findStrudelFlowNotesSound,
  pickStrudelFlowNotation,
  resolveStrudelFlowNotation
} from './notationPick'
import type { StrudelFlowEdge, StrudelFlowNode, StrudelFlowNodeData } from './types'

const node = (id: string, data: StrudelFlowNodeData): StrudelFlowNode => ({
  id,
  type: 'strudel',
  position: { x: 0, y: 0 },
  data
})

const edge = (source: string, target: string): StrudelFlowEdge => ({
  id: `${source}-${target}`,
  source,
  target
})

describe('pickStrudelFlowNotation', () => {
  it.each([
    ['gm_electric_bass_finger', 'bass'],
    ['gm_synth_bass_1', 'bass'],
    ['gm_acoustic_guitar_nylon', 'guitar'],
    ['gm_electric_guitar_clean', 'guitar'],
    ['piano', 'sheet'],
    ['gm_epiano1', 'sheet'],
    ['gm_church_organ', 'sheet'],
    ['GM_Acoustic_Grand_Piano', 'sheet'],
    ['sawtooth', 'names'],
    ['', 'names']
  ])('draws %s as %s', (sound, view) => {
    // Act
    const picked = pickStrudelFlowNotation(sound)

    // Assert
    expect(picked).toBe(view)
  })
})

describe('resolveStrudelFlowNotation', () => {
  it('lets Auto follow the sound', () => {
    // Act
    const view = resolveStrudelFlowNotation('auto', 'gm_electric_bass_finger')

    // Assert
    expect(view).toBe('bass')
  })

  it('keeps a notation picked by hand whatever the sound', () => {
    // Act
    const view = resolveStrudelFlowNotation('piano', 'gm_electric_bass_finger')

    // Assert
    expect(view).toBe('piano')
  })
})

describe('findStrudelFlowNotesSound', () => {
  it('reads the sound of a Voice node the notes reach through other nodes', () => {
    // Arrange
    const nodes = [
      node('notes-1', { kind: 'notes', pattern: 'c3', notation: 'auto' }),
      node('filter-1', { kind: 'filter', cutoff: 800, resonance: 1 }),
      node('voice-1', { kind: 'voice', sound: 'gm_electric_bass_finger' })
    ]
    const edges = [edge('notes-1', 'filter-1'), edge('filter-1', 'voice-1')]

    // Act
    const sound = findStrudelFlowNotesSound('notes-1', nodes, edges)

    // Assert
    expect(sound).toBe('gm_electric_bass_finger')
  })

  it('falls back to an .s() call kept on the node itself', () => {
    // Arrange
    const nodes = [
      node('notes-1', {
        kind: 'notes',
        pattern: 'c3',
        notation: 'auto',
        calls: [{ method: 's', argument: '"piano"' }]
      })
    ]

    // Act
    const sound = findStrudelFlowNotesSound('notes-1', nodes, [])

    // Assert
    expect(sound).toBe('piano')
  })

  it('finds no sound when nothing sets one', () => {
    // Arrange
    const nodes = [node('notes-1', { kind: 'notes', pattern: 'c3', notation: 'auto' })]

    // Act
    const sound = findStrudelFlowNotesSound('notes-1', nodes, [])

    // Assert
    expect(sound).toBe('')
  })
})
