import { describe, it, expect } from 'vitest'
import { ELECTRO_TUNES, STRUDEL_MUSIC_STYLES } from '../config'
import { detectMusicStyle } from './detectMusicStyle'
import { buildMissingHints } from './missingHints'
import { readStrudelCodeFacts } from './readStrudelCodeFacts'
import { buildReviewHints } from './reviewHints'

const detectFromCode = (code: string) =>
  detectMusicStyle({
    styles: STRUDEL_MUSIC_STYLES,
    pickedStyleId: null,
    facts: readStrudelCodeFacts(code)
  })

const songsNamingStyle = (styleId: string) =>
  ELECTRO_TUNES.filter((song) => {
    const detection = detectFromCode(song.code)
    return detection?.source === 'comment' && detection.style.id === styleId
  })

describe('the song for each style', () => {
  it.each(STRUDEL_MUSIC_STYLES.map((style) => ({ styleId: style.id, style })))(
    '$styleId has at least one, and its hints find each complete',
    ({ styleId, style }) => {
      // Arrange
      const songs = songsNamingStyle(styleId)
      const incompleteHints = songs.flatMap(({ code }) => {
        const context = { code, facts: readStrudelCodeFacts(code), style }
        return [...buildMissingHints(context), ...buildReviewHints(context)].map(
          (hint) => hint.title
        )
      })

      // Act
      const songCount = songs.length

      // Assert
      expect(songCount).toBeGreaterThanOrEqual(1)
      expect(incompleteHints).toEqual([])
    }
  )

  it.each(STRUDEL_MUSIC_STYLES.map((style) => ({ styleId: style.id })))(
    '$styleId is arranged in sections rather than one loop',
    ({ styleId }) => {
      // Arrange
      const codes = songsNamingStyle(styleId).map(({ code }) => code)

      // Act
      const sectionCounts = codes.map(
        (code) => code.match(/\.mask\(("<|[a-z])|arrange\(/g)?.length ?? 0
      )

      // Assert
      expect(sectionCounts.every((sectionCount) => sectionCount >= 2)).toBe(true)
    }
  )
})
