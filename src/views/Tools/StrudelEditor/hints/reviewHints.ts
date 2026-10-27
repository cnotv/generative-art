import { STRUDEL_INSTRUMENT_ROLE_LABELS } from '../config'
import type { StrudelHint, StrudelHintContext, StrudelInstrumentRole } from '../types'
import { joinWithAnd } from './joinWithAnd'
import { playsStyleInstrument } from './playsStyleInstrument'

const roleText = (roles: StrudelInstrumentRole[]): string =>
  joinWithAnd(roles.map((role) => STRUDEL_INSTRUMENT_ROLE_LABELS[role]))

// Muting rather than deleting keeps the layer to bring back: Strudel plays nothing for `_$:`.
const muteEdit = (from: number) => [{ from, to: from, insert: '_' }]

const buildStackedVisualHints = ({ code, facts }: StrudelHintContext): StrudelHint[] =>
  facts.patternStatements
    .filter((statement) => statement.visualCalls.length > 1)
    .map((statement) => {
      const extraCalls = statement.visualCalls.slice(1)
      return {
        id: `review-visuals-${statement.line}`,
        kind: 'review',
        title: `Keep one visual on line ${statement.line}`,
        reason: `The ${joinWithAnd(statement.visualNames)} on line ${statement.line} draw over each other, so only the ${statement.visualNames[0]} stays.`,
        snippet: extraCalls.map(({ from, to }) => code.slice(from, to)).join(''),
        actionLabel: 'Remove',
        edits: extraCalls.map(({ from, to }) => ({ from, to, insert: '' }))
      }
    })

const buildOffStyleHints = ({ facts, style }: StrudelHintContext): StrudelHint[] =>
  facts.patternStatements
    .filter(
      (statement) =>
        statement.isBlock &&
        statement.instrumentRoles.length > 0 &&
        !playsStyleInstrument(statement, style)
    )
    .map((statement) => ({
      id: `review-off-style-${statement.line}`,
      kind: 'review',
      title: `Mute the ${roleText(statement.instrumentRoles)} on line ${statement.line}`,
      reason: `${style.label} isn't usually built with ${roleText(statement.instrumentRoles)}. Muting keeps the layer in the code: delete the _ to bring it back.`,
      snippet: '_$:',
      actionLabel: 'Mute',
      edits: muteEdit(statement.from)
    }))

// A block whose every instrument an earlier layer already plays only thickens that part.
const buildDoubledLayerHints = ({ facts, style }: StrudelHintContext): StrudelHint[] =>
  facts.patternStatements.flatMap((statement, index) => {
    const earlierStatements = facts.patternStatements.slice(0, index)
    const firstSharingStatement = earlierStatements.find((earlier) =>
      earlier.instrumentRoles.some((role) => statement.instrumentRoles.includes(role))
    )
    const isDoubled =
      statement.isBlock &&
      statement.instrumentRoles.length > 0 &&
      playsStyleInstrument(statement, style) &&
      statement.instrumentRoles.every((role) =>
        earlierStatements.some((earlier) => earlier.instrumentRoles.includes(role))
      )
    if (!isDoubled || firstSharingStatement === undefined) {
      return []
    }
    return [
      {
        id: `review-doubled-${statement.line}`,
        kind: 'review',
        title: `Mute the second ${roleText(statement.instrumentRoles)} on line ${statement.line}`,
        reason: `Line ${firstSharingStatement.line} already plays the ${roleText(statement.instrumentRoles)}, and two layers of one part blur each other. Muting keeps it in the code to bring back.`,
        snippet: '_$:',
        actionLabel: 'Mute',
        edits: muteEdit(statement.from)
      }
    ]
  })

/**
 * What to reconsider in the layers already there: visuals stacked on one layer, blocks playing
 * instruments the style isn't built with, and blocks that only double an earlier layer.
 * @param context - the code, its facts and its style
 * @returns the hints, in that order
 */
export const buildReviewHints = (context: StrudelHintContext): StrudelHint[] => [
  ...buildStackedVisualHints(context),
  ...buildOffStyleHints(context),
  ...buildDoubledLayerHints(context)
]
