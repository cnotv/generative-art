import type { StrudelHint, StrudelHintContext } from '../types'
import { buildIdeaHints } from './ideaHints'
import { buildMissingHints } from './missingHints'
import { buildReviewHints } from './reviewHints'

/**
 * Every hint for a pattern: first what to reconsider in the layers already there, then what
 * its style is missing, then ideas to keep it going.
 * @param context - the code, its facts and its style
 * @returns the hints, in that order
 */
export const buildStrudelHints = (context: StrudelHintContext): StrudelHint[] => [
  ...buildReviewHints(context),
  ...buildMissingHints(context),
  ...buildIdeaHints(context)
]
