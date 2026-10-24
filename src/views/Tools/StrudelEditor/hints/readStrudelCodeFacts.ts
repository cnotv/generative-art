import { javascriptLanguage } from '@codemirror/lang-javascript'
import {
  STRUDEL_BASS_MAX_OCTAVE,
  STRUDEL_INSTRUMENT_CALL_NAMES,
  STRUDEL_INSTRUMENT_SOUND_NAMES,
  STRUDEL_SETUP_CALL_NAMES,
  STRUDEL_TEMPO_CALL_FACTORS,
  STRUDEL_VISUAL_CALL_NAMES
} from '../config'
import type {
  StrudelCodeFacts,
  StrudelCodeRange,
  StrudelCodeTempo,
  StrudelInstrumentRole,
  StrudelVisualName
} from '../types'

type ParsedNode = ReturnType<typeof javascriptLanguage.parser.parse>['topNode']

const COMMENT_NODE_NAMES = new Set(['LineComment', 'BlockComment'])
const STRING_NODE_NAMES = new Set(['String', 'TemplateString'])
const NAME_NODE_NAMES = new Set(['VariableName', 'PropertyName'])
const NOTE_NAME_PATTERN = /^[a-g][#bfs]?(\d)$/
const TEMPO_ARGUMENT_PATTERN = /^\s*(?:\d+\.?\d*|\.\d+)(?:\s*[*/]\s*(?:\d+\.?\d*|\.\d+))*\s*$/
const TEMPO_TOKEN_PATTERN = /[*/]|\d+\.?\d*|\.\d+/g
// `//` and `/*` open a comment and `*/` closes it, all two characters long.
const COMMENT_MARK_LENGTH = 2
const SOUND_TOKEN_SEPARATOR = /[^\d#a-z]+/

const siblingsFrom = (node: ParsedNode | null): ParsedNode[] =>
  node === null ? [] : [node, ...siblingsFrom(node.nextSibling)]

const childrenOf = (node: ParsedNode): ParsedNode[] => siblingsFrom(node.firstChild)

const descendantsOf = (node: ParsedNode): ParsedNode[] => [
  node,
  ...childrenOf(node).flatMap(descendantsOf)
]

const textOf = (code: string, node: ParsedNode): string => code.slice(node.from, node.to)

const stripCommentMarks = (commentText: string): string =>
  commentText.startsWith('//')
    ? commentText.slice(COMMENT_MARK_LENGTH).trim()
    : commentText.slice(COMMENT_MARK_LENGTH, -COMMENT_MARK_LENGTH).trim()

const readFirstLineComment = (code: string, topLevelNodes: ParsedNode[]): string | null => {
  const firstNode = topLevelNodes.at(0)
  const startsOnFirstLine = firstNode !== undefined && !code.slice(0, firstNode.from).includes('\n')
  return startsOnFirstLine && COMMENT_NODE_NAMES.has(firstNode.name)
    ? stripCommentMarks(textOf(code, firstNode))
    : null
}

const readHeaderEnd = (topLevelNodes: ParsedNode[]): number => {
  const firstCodeIndex = topLevelNodes.findIndex((node) => !COMMENT_NODE_NAMES.has(node.name))
  const headerNodes = firstCodeIndex === -1 ? topLevelNodes : topLevelNodes.slice(0, firstCodeIndex)
  return headerNodes.at(-1)?.to ?? 0
}

// A statement's expression ends before any semicolon, which is where a chained call has to go.
const expressionEnd = (statement: ParsedNode): number => {
  const lastChild = childrenOf(statement).findLast((child) => child.name !== ';')
  if (lastChild === undefined) {
    return statement.to
  }
  return lastChild.name === 'ExpressionStatement' ? expressionEnd(lastChild) : lastChild.to
}

const calleeNameOf = (code: string, statement: ParsedNode): string | null => {
  const expression = statement.firstChild
  const callee = expression?.name === 'CallExpression' ? expression.firstChild : null
  return callee?.name === 'VariableName' ? textOf(code, callee) : null
}

const isSetupStatement = (code: string, statement: ParsedNode): boolean =>
  statement.firstChild?.name === 'AwaitExpression' ||
  STRUDEL_SETUP_CALL_NAMES.includes(calleeNameOf(code, statement) ?? '')

const evaluateTempoArgument = (argumentText: string): number | null => {
  if (!TEMPO_ARGUMENT_PATTERN.test(argumentText)) {
    return null
  }
  const tokens = argumentText.match(TEMPO_TOKEN_PATTERN) ?? []
  return tokens.slice(1).reduce(
    (state, token) => {
      if (token === '*' || token === '/') {
        return { ...state, operator: token }
      }
      const operand = Number(token)
      const value = state.operator === '*' ? state.value * operand : state.value / operand
      return { value, operator: state.operator }
    },
    { value: Number(tokens[0]), operator: '*' }
  ).value
}

const readTempo = (code: string, statement: ParsedNode): StrudelCodeTempo | null => {
  const calleeName = calleeNameOf(code, statement)
  const factor = calleeName === null ? undefined : STRUDEL_TEMPO_CALL_FACTORS[calleeName]
  if (factor === undefined) {
    return null
  }
  const argumentList = statement.firstChild?.lastChild
  const argumentText =
    argumentList === null || argumentList === undefined ? '' : textOf(code, argumentList)
  const argumentValue = evaluateTempoArgument(argumentText.slice(1, -1))
  return {
    beatsPerMinute: argumentValue === null ? null : Math.round(argumentValue * factor * 100) / 100,
    statement: { from: statement.from, to: statement.to }
  }
}

const soundTokensOf = (code: string, nodes: ParsedNode[]): string[] =>
  nodes
    .filter((node) => STRING_NODE_NAMES.has(node.name))
    .flatMap((node) => textOf(code, node).slice(1, -1).toLowerCase().split(SOUND_TOKEN_SEPARATOR))
    .filter((token) => token.length > 0)

const noteRolesOf = (soundTokens: string[]): StrudelInstrumentRole[] =>
  soundTokens
    .map((token) => NOTE_NAME_PATTERN.exec(token)?.[1])
    .filter((octave): octave is string => octave !== undefined)
    .map((octave) => (Number(octave) <= STRUDEL_BASS_MAX_OCTAVE ? 'bass' : 'melody'))

const readInstrumentRoles = (
  soundTokens: string[],
  callNames: string[]
): StrudelInstrumentRole[] => {
  const soundRoles = Object.entries(STRUDEL_INSTRUMENT_SOUND_NAMES)
    .filter(([, soundNames]) => soundNames.some((soundName) => soundTokens.includes(soundName)))
    .map(([role]) => role as StrudelInstrumentRole)
  const callRoles = Object.entries(STRUDEL_INSTRUMENT_CALL_NAMES)
    .filter(([, roleCallNames]) => roleCallNames?.some((callName) => callNames.includes(callName)))
    .map(([role]) => role as StrudelInstrumentRole)
  return [...new Set([...soundRoles, ...callRoles, ...noteRolesOf(soundTokens)])]
}

const readVisualNames = (callNames: string[]): StrudelVisualName[] => [
  ...new Set(
    callNames
      .filter((callName) => Object.hasOwn(STRUDEL_VISUAL_CALL_NAMES, callName))
      .map((callName) => STRUDEL_VISUAL_CALL_NAMES[callName])
  )
]

/**
 * Reads what the hints need from a pattern's code: its first-line comment, its tempo, the
 * instruments its sounds and calls point to, the visuals it draws and where its patterns are.
 * Comments are left out of everything but the style, so a comment naming a sound adds nothing.
 * @param code - the pattern's code
 * @returns the facts read from its syntax tree
 */
export const readStrudelCodeFacts = (code: string): StrudelCodeFacts => {
  const topNode = javascriptLanguage.parser.parse(code).topNode
  const topLevelNodes = childrenOf(topNode)
  const statements = topLevelNodes.filter(
    (node) => node.name === 'ExpressionStatement' || node.name === 'LabeledStatement'
  )
  const patternStatements: StrudelCodeRange[] = statements
    .filter((statement) => !isSetupStatement(code, statement))
    .map((statement) => ({ from: statement.from, to: expressionEnd(statement) }))
  const allNodes = descendantsOf(topNode)
  const callNames = allNodes
    .filter((node) => NAME_NODE_NAMES.has(node.name))
    .map((node) => textOf(code, node))
  return {
    firstLineComment: readFirstLineComment(code, topLevelNodes),
    headerEnd: readHeaderEnd(topLevelNodes),
    tempo:
      statements.map((statement) => readTempo(code, statement)).find((tempo) => tempo !== null) ??
      null,
    instrumentRoles: readInstrumentRoles(soundTokensOf(code, allNodes), callNames),
    visualNames: readVisualNames(callNames),
    patternStatements,
    usesPatternBlocks: statements.some((statement) => statement.name === 'LabeledStatement')
  }
}
