import { describe, it, expect } from 'vitest'
import { isImageFile, isMidiFile } from './runTranscription'

describe('isMidiFile', () => {
  it.each([
    ['song.mid', '', true],
    ['SONG.MIDI', '', true],
    ['untitled', 'audio/midi', true],
    ['loop.mp3', 'audio/mpeg', false],
    ['middle.wav', 'audio/wav', false]
  ])('reads %s (%s) as MIDI: %s', (fileName, fileType, expected) => {
    // Arrange
    const chosenFile = new File(['data'], fileName, { type: fileType })

    // Act
    const isMidi = isMidiFile(chosenFile)

    // Assert
    expect(isMidi).toBe(expected)
  })
})

describe('isImageFile', () => {
  it.each([
    ['riff.png', '', true],
    ['RIFF.JPEG', '', true],
    ['shot', 'image/webp', true],
    ['loop.mp3', 'audio/mpeg', false],
    ['song.mid', 'audio/midi', false]
  ])('reads %s (%s) as an image: %s', (fileName, fileType, expected) => {
    // Arrange
    const chosenFile = new File(['data'], fileName, { type: fileType })

    // Act
    const isImage = isImageFile(chosenFile)

    // Assert
    expect(isImage).toBe(expected)
  })
})
