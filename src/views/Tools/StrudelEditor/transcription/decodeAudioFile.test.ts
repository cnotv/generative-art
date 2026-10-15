import { describe, it, expect } from 'vitest'
import { downmixChannels } from './decodeAudioFile'

describe('downmixChannels', () => {
  it.each([
    ['one channel', [[0.5, -0.5]], [0.5, -0.5]],
    [
      'two channels',
      [
        [1, 0],
        [0, 1]
      ],
      [0.5, 0.5]
    ],
    ['no channels', [], []]
  ])('averages %s', (_label, channelValues, expectedMono) => {
    // Arrange
    const channels = channelValues.map((values) => Float32Array.from(values))

    // Act
    const mono = downmixChannels(channels)

    // Assert
    expect([...mono]).toEqual(expectedMono)
  })
})
