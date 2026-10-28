import { describe, it, expect } from 'vitest'
import { Midi } from '@tonejs/midi'
import { transcribeMidi } from './midi'

const PERCUSSION_CHANNEL = 9

type TestNote = { midi: number; step: number; steps?: number }

const createMidiFile = (
  options: { beatsPerMinute?: number; pitched?: TestNote[]; drums?: TestNote[] } = {}
): ArrayBuffer => {
  const midi = new Midi()
  const ticksPerStep = midi.header.ppq / 4
  if (options.beatsPerMinute !== undefined) {
    midi.header.setTempo(options.beatsPerMinute)
  }
  const addNotes = (notes: TestNote[], channel: number): void => {
    const track = midi.addTrack()
    track.channel = channel
    notes.forEach((note) =>
      track.addNote({
        midi: note.midi,
        ticks: note.step * ticksPerStep,
        durationTicks: (note.steps ?? 1) * ticksPerStep
      })
    )
  }
  addNotes(options.pitched ?? [], 0)
  addNotes(options.drums ?? [], PERCUSSION_CHANNEL)
  const bytes = midi.toArray()
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

describe('transcribeMidi', () => {
  it('reads the tempo from the file', () => {
    // Arrange
    const buffer = createMidiFile({ beatsPerMinute: 96, pitched: [{ midi: 48, step: 0 }] })

    // Act
    const result = transcribeMidi(buffer)

    // Assert
    expect(result.beatsPerMinute).toBe(96)
  })

  it('places percussion keys on the steps where they start', () => {
    // Arrange
    const buffer = createMidiFile({
      drums: [
        { midi: 36, step: 0 },
        { midi: 42, step: 2 },
        { midi: 38, step: 4 },
        { midi: 42, step: 4 }
      ]
    })

    // Act
    const [bar] = transcribeMidi(buffer).bars

    // Assert
    expect(bar.steps[0].drums).toEqual(['bd'])
    expect(bar.steps[1].drums).toEqual([])
    expect(bar.steps[2].drums).toEqual(['hh'])
    expect(bar.steps[4].drums).toEqual(['sd', 'hh'])
  })

  it('takes the lowest note starting on a step as the bass, without repeating held notes', () => {
    // Arrange
    const buffer = createMidiFile({
      pitched: [
        { midi: 45, step: 0, steps: 4 },
        { midi: 64, step: 0, steps: 4 },
        { midi: 50, step: 8 }
      ]
    })

    // Act
    const [bar] = transcribeMidi(buffer).bars

    // Assert
    expect(bar.steps[0].bassNote).toBe('a2')
    expect(bar.steps[1].bassNote).toBeNull()
    expect(bar.steps[8].bassNote).toBe('d3')
  })

  it('names the triad held across a bar and splits notes into bars', () => {
    // Arrange
    const buffer = createMidiFile({
      pitched: [
        { midi: 57, step: 0, steps: 16 },
        { midi: 60, step: 0, steps: 16 },
        { midi: 64, step: 0, steps: 16 },
        { midi: 53, step: 16, steps: 16 },
        { midi: 57, step: 16, steps: 16 },
        { midi: 60, step: 16, steps: 16 }
      ]
    })

    // Act
    const result = transcribeMidi(buffer)

    // Assert
    expect(result.bars.map((bar) => bar.chord)).toEqual(['Am', 'F'])
  })

  it('refuses a file without notes', () => {
    // Arrange
    const buffer = createMidiFile()

    // Act
    const transcribe = (): unknown => transcribeMidi(buffer)

    // Assert
    expect(transcribe).toThrow('The MIDI file has no notes')
  })
})
