import type { StrudelMusicStyle, StrudelPatternStatement } from '../types'

/**
 * Whether a layer plays at least one instrument the style is built with. A layer that doesn't
 * is offered for muting, so nothing new is chained onto it.
 * @param statement - the layer
 * @param style - the pattern's style
 * @returns true when one of its instruments is one of the style's
 */
export const playsStyleInstrument = (
  statement: StrudelPatternStatement,
  style: StrudelMusicStyle
): boolean =>
  statement.instrumentRoles.some((role) =>
    style.instruments.some((instrument) => instrument.role === role)
  )
