// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { Midi } from '@tonejs/midi'
import { SONGS, type RgDifficulty, type RgSong } from './config'
import { fetchSongBacking, fetchSongNotes } from './loadRhythmSong'
import { parseMidiBuffer } from './parseMidi'

const AUDIO_DIRECTORY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../assets/audio/rhythmgame'
)
const BEATS_PER_BAR = 4
const INTRO_BARS = 4
const LANE_COUNT = 4
const LARGEST_LANE_SHARE = 0.5
const MAX_BACKING_BYTES = 1_000_000
const MILLISECONDS_PER_MINUTE = 60_000
const PITCH_CLASSES = 12

const PITCH_CLASSES_BY_SONG: [Exclude<RgSong, 'custom'>, number[]][] = [
  ['electric-pulse', [9, 11, 0, 2, 4, 5, 7]],
  ['neon-chase', [4, 6, 7, 9, 11, 0, 2]],
  // D minor, with the raised third of the A chord that closes the lift.
  ['grid-storm', [2, 4, 5, 7, 9, 10, 0, 1]]
]

const readBytes = (fileName: string): ArrayBuffer => {
  const file = readFileSync(resolve(AUDIO_DIRECTORY, fileName))
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
}

const readChart = (song: RgSong, difficulty: RgDifficulty) =>
  parseMidiBuffer(readBytes(`${song}.mid`), difficulty)

describe('RhythmGame song files', () => {
  it.each(PITCH_CLASSES_BY_SONG)('%s has a chart that stays in key', (song, pitchClasses) => {
    // Arrange
    const notes = readChart(song, 'hard')

    // Act
    const outOfKeyNotes = notes.filter(
      (note) => !pitchClasses.includes(note.midiNote % PITCH_CLASSES)
    )

    // Assert
    expect(outOfKeyNotes).toEqual([])
  })

  it.each(SONGS.map((song) => [song.id, song.bpm] as const))(
    '%s is charted at %i BPM, with the first note after its intro',
    (song, beatsPerMinute) => {
      // Arrange
      const midi = new Midi(readBytes(`${song}.mid`))
      const introMs = (INTRO_BARS * BEATS_PER_BAR * MILLISECONDS_PER_MINUTE) / beatsPerMinute

      // Act
      const [firstNote] = readChart(song, 'hard')

      // Assert
      expect(midi.header.tempos[0].bpm).toBeCloseTo(beatsPerMinute)
      expect(firstNote.time).toBeGreaterThanOrEqual(Math.floor(introMs))
    }
  )

  it.each(SONGS.map((song) => [song.id] as const))('%s fills every lane evenly', (song) => {
    // Arrange
    const notes = readChart(song, 'hard')

    // Act
    const laneCounts = Array.from(
      { length: LANE_COUNT },
      (_, lane) => notes.filter((note) => note.lane === lane).length
    )

    // Assert
    expect(Math.min(...laneCounts)).toBeGreaterThan(0)
    expect(Math.max(...laneCounts)).toBeLessThanOrEqual(notes.length * LARGEST_LANE_SHARE)
  })

  it.each(SONGS.map((song) => [song.id] as const))('%s gets harder each difficulty', (song) => {
    // Arrange
    const noteCount = (difficulty: RgDifficulty) => readChart(song, difficulty).length

    // Act
    const [easyCount, mediumCount, hardCount] = [
      noteCount('easy'),
      noteCount('medium'),
      noteCount('hard')
    ]

    // Assert
    expect(easyCount).toBeLessThan(mediumCount)
    expect(mediumCount).toBeLessThan(hardCount)
  })

  it.each(SONGS.map((song) => [song.id] as const))(
    '%s ships a backing small enough to load during the countdown',
    (song) => {
      // Act
      const backingBytes = readBytes(`${song}.mp3`).byteLength

      // Assert
      expect(backingBytes).toBeGreaterThan(0)
      expect(backingBytes).toBeLessThan(MAX_BACKING_BYTES)
    }
  )
})

describe('loading a song', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('has no backing track for an uploaded song', async () => {
    // Arrange
    const fetchFile = vi.fn()
    vi.stubGlobal('fetch', fetchFile)

    // Act
    const backing = await fetchSongBacking('custom')

    // Assert
    expect(backing).toBeNull()
    expect(fetchFile).not.toHaveBeenCalled()
  })

  it.each<[string, RgSong, Response | null]>([
    ['the song does not exist', 'custom', null],
    ['the file is missing', 'neon-chase', new Response(null, { status: 404 })]
  ])('fails when %s', async (_case, song, response) => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    // Act
    const loading = fetchSongNotes(song, 'easy')

    // Assert
    await expect(loading).rejects.toThrow()
  })
})
