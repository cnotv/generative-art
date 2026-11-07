import { describe, expect, it } from 'vitest'
import { parseStrudelFlowSampleLayers, writeStrudelFlowSampleLayers } from './sampleSequence'

describe('parseStrudelFlowSampleLayers', () => {
  it('reads samples, rests, repeats, euclidean rhythms and nested groups', () => {
    // Arrange
    const pattern = 'bd*2 [~ sd:3] <hh oh>/2 perc(3,8,2)'

    // Act
    const layers = parseStrudelFlowSampleLayers(pattern)

    // Assert
    expect(layers).toEqual([
      [
        { kind: 'sound', sound: 'bd', modifier: '*2' },
        {
          kind: 'group',
          bracket: 'subdivide',
          layers: [[{ kind: 'rest' }, { kind: 'sound', sound: 'sd:3', modifier: '' }]],
          modifier: ''
        },
        {
          kind: 'group',
          bracket: 'alternate',
          layers: [
            [
              { kind: 'sound', sound: 'hh', modifier: '' },
              { kind: 'sound', sound: 'oh', modifier: '' }
            ]
          ],
          modifier: '/2'
        },
        { kind: 'sound', sound: 'perc', modifier: '(3,8,2)' }
      ]
    ])
  })

  it('splits layers at top-level commas only', () => {
    // Arrange
    const pattern = 'bd*4, [~ hh]*4, [bd,cp]'

    // Act
    const layers = parseStrudelFlowSampleLayers(pattern)

    // Assert
    expect(layers).toHaveLength(3)
    expect(layers[2][0]).toMatchObject({
      kind: 'group',
      layers: [[{ sound: 'bd' }], [{ sound: 'cp' }]]
    })
  })

  it('keeps notation it has no control for as text', () => {
    // Arrange
    const pattern = 'bd {sd cp}%4 hh^2'

    // Act
    const layers = parseStrudelFlowSampleLayers(pattern)

    // Assert
    expect(layers[0].map((step) => step.kind)).toEqual(['sound', 'text', 'text'])
  })

  it.each([
    'bd*2 [~ sd] bd sd',
    'bd*4, [~ hh]*4',
    '<bd [sd sd]>*2 ~ hh?',
    'bd(3,8) [hh hh]!2 {sd cp}%4',
    'breaks165:2@3 ~'
  ])('writes %s back unchanged', (pattern) => {
    // Act
    const written = writeStrudelFlowSampleLayers(parseStrudelFlowSampleLayers(pattern))

    // Assert
    expect(written).toBe(pattern)
  })
})
