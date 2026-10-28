import { STRUDEL_PATTERN_IDEAS, STRUDEL_PATTERN_IDEA_LIMIT } from '../config'
import type { StrudelHint, StrudelHintContext } from '../types'
import { playsStyleInstrument } from './playsStyleInstrument'

/**
 * Where to take the pattern next: variations such as a breakdown, a filter sweep or drum
 * fills, each chained onto the first layer it suits that doesn't have it yet. Layers the style
 * isn't built with are left out, since the review offers to mute those.
 * @param context - the code, its facts and its style
 * @returns up to a few ideas, in the order the config lists them
 */
export const buildIdeaHints = ({ facts, style }: StrudelHintContext): StrudelHint[] => {
  const styleLayers = facts.patternStatements.filter((statement) =>
    playsStyleInstrument(statement, style)
  )
  return STRUDEL_PATTERN_IDEAS.flatMap((idea) => {
    const statement = idea.targetRoles
      .map((role) =>
        styleLayers.find(
          (candidate) =>
            candidate.instrumentRoles.includes(role) && !candidate.callNames.includes(idea.callName)
        )
      )
      .find((candidate) => candidate !== undefined)
    return statement === undefined
      ? []
      : [
          {
            id: `idea-${idea.id}`,
            kind: 'idea' as const,
            title: `${idea.title} on line ${statement.line}`,
            reason: idea.reason,
            snippet: idea.snippet,
            actionLabel: 'Add',
            edits: [{ from: statement.to, to: statement.to, insert: idea.snippet }]
          }
        ]
  }).slice(0, STRUDEL_PATTERN_IDEA_LIMIT)
}
