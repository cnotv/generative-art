import { STRUDEL_DEFAULT_BEATS_PER_MINUTE } from '../config'
import type {
  StrudelCodeFacts,
  StrudelMusicStyle,
  StrudelMusicStyleId,
  StrudelStyleDetection
} from '../types'

type StyleDetectionOptions = {
  styles: StrudelMusicStyle[]
  pickedStyleId: StrudelMusicStyleId | null
  facts: StrudelCodeFacts
}

const escapeRegularExpression = (text: string): string =>
  text.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&')

// A whole word or phrase, so "house" is not found in "lighthouse".
const commentNamesKeyword = (comment: string, keyword: string): boolean =>
  new RegExp(`(^|[^a-z0-9])${escapeRegularExpression(keyword)}($|[^a-z0-9])`).test(comment)

const findStyleInComment = (
  styles: StrudelMusicStyle[],
  comment: string
): StrudelMusicStyle | null => {
  const lowercaseComment = comment.toLowerCase()
  const matches = styles.flatMap((style) =>
    style.keywords
      .filter((keyword) => commentNamesKeyword(lowercaseComment, keyword))
      .map((keyword) => ({ style, keyword }))
  )
  // The longest phrase is the most specific, so "dub techno" is techno rather than dub.
  const bestMatch = matches.reduce<(typeof matches)[number] | null>(
    (best, match) => (best === null || match.keyword.length > best.keyword.length ? match : best),
    null
  )
  return bestMatch?.style ?? null
}

const distanceFromTempoRange = (style: StrudelMusicStyle, beatsPerMinute: number): number =>
  Math.max(style.minBeatsPerMinute - beatsPerMinute, beatsPerMinute - style.maxBeatsPerMinute, 0)

const readPlayingTempo = (facts: StrudelCodeFacts): number | null =>
  facts.tempo === null ? STRUDEL_DEFAULT_BEATS_PER_MINUTE : facts.tempo.beatsPerMinute

const stylesAtTempo = (
  styles: StrudelMusicStyle[],
  beatsPerMinute: number | null
): StrudelMusicStyle[] =>
  beatsPerMinute === null
    ? styles
    : styles.filter((style) => distanceFromTempoRange(style, beatsPerMinute) === 0)

const playsDefiningRoles = (style: StrudelMusicStyle, facts: StrudelCodeFacts): boolean =>
  style.definingRoles.every((role) => facts.instrumentRoles.includes(role))

// One point per instrument the style expects and the code has, and one for a tempo the code
// sets on purpose inside the style's range; the default tempo proves nothing.
const scoreStyle = (style: StrudelMusicStyle, facts: StrudelCodeFacts): number => {
  const instrumentMatches = style.instruments.filter((instrument) =>
    facts.instrumentRoles.includes(instrument.role)
  ).length
  const setBeatsPerMinute = facts.tempo?.beatsPerMinute ?? null
  const tempoMatch =
    setBeatsPerMinute !== null && distanceFromTempoRange(style, setBeatsPerMinute) === 0 ? 1 : 0
  return instrumentMatches + tempoMatch
}

// Most songs are not one of these styles, so a guess takes the style's tempo and what defines it:
// a guitar riff at 120 BPM has a bassline and a house tempo, and is still not house.
const guessStyleFromCode = (
  styles: StrudelMusicStyle[],
  facts: StrudelCodeFacts
): StrudelMusicStyle | null => {
  const scoredStyles = stylesAtTempo(styles, readPlayingTempo(facts))
    .filter((style) => playsDefiningRoles(style, facts))
    .map((style) => ({ style, score: scoreStyle(style, facts) }))
  const best = scoredStyles.reduce<(typeof scoredStyles)[number] | null>(
    (currentBest, scored) =>
      currentBest === null || scored.score > currentBest.score ? scored : currentBest,
    null
  )
  return best?.style ?? null
}

/**
 * The pattern's style: the one picked in the hints tab, else the one its first-line comment
 * names, else a guess from the tempo it plays at and the instruments it uses.
 * @param options - the styles to choose from, the picked style and the code's facts
 * @returns the style and where it came from, or null when nothing points to one
 */
export const detectMusicStyle = ({
  styles,
  pickedStyleId,
  facts
}: StyleDetectionOptions): StrudelStyleDetection | null => {
  const pickedStyle = styles.find((style) => style.id === pickedStyleId)
  if (pickedStyle !== undefined) {
    return { style: pickedStyle, source: 'picker' }
  }
  const commentStyle =
    facts.firstLineComment === null ? null : findStyleInComment(styles, facts.firstLineComment)
  if (commentStyle !== null) {
    return { style: commentStyle, source: 'comment' }
  }
  const guessedStyle = guessStyleFromCode(styles, facts)
  return guessedStyle === null ? null : { style: guessedStyle, source: 'code' }
}
