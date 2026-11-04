import { SONGS, type RgDifficulty, type RgSong, type RhythmNote } from './config'
import { parseMidiBuffer } from './parseMidi'

const findSong = (song: RgSong) => {
  const songDefinition = SONGS.find((candidate) => candidate.id === song)
  if (songDefinition === undefined) throw new Error(`No built-in song called ${song}`)
  return songDefinition
}

const fetchBytes = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`)
  return response.arrayBuffer()
}

/**
 * Loads a built-in song's chart at a difficulty.
 * @param song - The song to load
 * @param difficulty - Sets how many of the melody's notes the chart keeps
 * @returns The chart's notes
 */
export const fetchSongNotes = async (
  song: RgSong,
  difficulty: RgDifficulty
): Promise<RhythmNote[]> => parseMidiBuffer(await fetchBytes(findSong(song).chartUrl), difficulty)

/**
 * Loads the recording that plays behind a built-in song. An uploaded song has none.
 * @param song - The song being played
 * @returns The encoded file, or null when the song has no recording
 */
export const fetchSongBacking = async (song: RgSong): Promise<ArrayBuffer | null> =>
  song === 'custom' ? null : fetchBytes(findSong(song).backingUrl)
