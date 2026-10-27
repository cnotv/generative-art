import { STRUDEL_VISUAL_TARGET_ROLES } from '../config'
import type { StrudelPatternStatement, StrudelVisualName } from '../types'

type VisualTarget = {
  visualName: StrudelVisualName
  statement: StrudelPatternStatement
}

/**
 * Gives each visual its own layer: the first one playing the instrument it suits best that
 * draws nothing yet and has not gone to an earlier visual. Two visuals on one pattern draw over
 * each other, so a punchcard lands on the drums and a pianoroll on the melody instead.
 * @param statements - the layers a visual may go on
 * @param visualNames - the visuals to place, in order of priority
 * @returns each visual that found a layer, with that layer
 */
export const assignVisualTargets = (
  statements: StrudelPatternStatement[],
  visualNames: StrudelVisualName[]
): VisualTarget[] =>
  visualNames.reduce<VisualTarget[]>((assignedTargets, visualName) => {
    const claimedStarts = new Set(assignedTargets.map(({ statement }) => statement.from))
    const freeStatements = statements.filter(
      (statement) => statement.visualNames.length === 0 && !claimedStarts.has(statement.from)
    )
    const statement = STRUDEL_VISUAL_TARGET_ROLES[visualName]
      .map((role) => freeStatements.find((candidate) => candidate.instrumentRoles.includes(role)))
      .find((candidate) => candidate !== undefined)
    return statement === undefined
      ? assignedTargets
      : [...assignedTargets, { visualName, statement }]
  }, [])
