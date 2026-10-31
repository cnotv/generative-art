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
    '$styleId has exactly one, which its hints find complete',
    ({ styleId, style }) => {
      // Arrange
      const songs = songsNamingStyle(styleId)
      const code = songs[0]?.code ?? ''
      const context = { code, facts: readStrudelCodeFacts(code), style }

      // Act
      const missingHints = buildMissingHints(context).map((hint) => hint.title)
      const reviewHints = buildReviewHints(context).map((hint) => hint.title)

      // Assert
      expect(songs).toHaveLength(1)
      expect(missingHints).toEqual([])
      expect(reviewHints).toEqual([])
    }
  )

  it.each(STRUDEL_MUSIC_STYLES.map((style) => ({ styleId: style.id })))(
    '$styleId is arranged in sections rather than one loop',
    ({ styleId }) => {
      // Arrange
      const code = songsNamingStyle(styleId)[0]?.code ?? ''

      // Act
      const sectionCount = code.match(/\.mask\("</g)?.length ?? 0

      // Assert
      expect(sectionCount).toBeGreaterThanOrEqual(2)
    }
  )
})
