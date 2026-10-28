import { STRUDEL_FLOW_NOTATION_BY_SOUND } from './config'
import type {
  StrudelFlowEdge,
  StrudelFlowNode,
  StrudelFlowNotation,
  StrudelFlowNotationView
} from './types'

const SOUND_CALLS = new Set(['s', 'sound'])
const STRING_LITERAL_PATTERN = /^\s*(["'`])(.*)\1\s*$/

/**
 * The notation Auto draws a sound in: a bass or guitar tab, a piano roll, or note names.
 * @param sound - the sound name, such as `gm_electric_bass_finger`
 * @returns the view the sound's name points to, or note names when it points nowhere
 */
export const pickStrudelFlowNotation = (sound: string): StrudelFlowNotationView =>
  STRUDEL_FLOW_NOTATION_BY_SOUND.find((entry) => sound.toLowerCase().includes(entry.word))?.view ??
  'names'

/**
 * The view a node's notation setting comes down to.
 * @param notation - the node's setting
 * @param sound - the sound its notes play
 * @returns the setting itself, or Auto's pick for the sound
 */
export const resolveStrudelFlowNotation = (
  notation: StrudelFlowNotation,
  sound: string
): StrudelFlowNotationView => (notation === 'auto' ? pickStrudelFlowNotation(sound) : notation)

const downstreamVoiceSound = (
  startNodeId: string,
  nodes: StrudelFlowNode[],
  edges: StrudelFlowEdge[],
  visited: Set<string>
): string => {
  const next = edges
    .filter((edge) => edge.source === startNodeId && !visited.has(edge.target))
    .map((edge) => edge.target)
  const voice = next
    .map((nodeId) => nodes.find((node) => node.id === nodeId)?.data)
    .find((data) => data?.kind === 'voice')
  if (voice?.kind === 'voice') {
    return voice.sound
  }
  const seen = new Set([...visited, ...next])
  return next.reduce(
    (found, nodeId) =>
      found.length > 0 ? found : downstreamVoiceSound(nodeId, nodes, edges, seen),
    ''
  )
}

const ownSoundCall = (node: StrudelFlowNode | undefined): string => {
  const call = node?.data.calls?.find((candidate) => SOUND_CALLS.has(candidate.method))
  return call === undefined ? '' : (STRING_LITERAL_PATTERN.exec(call.argument)?.[2] ?? '')
}

/**
 * The sound a node's notes play: from the Voice node its cables reach, else from an `.s()`
 * call kept on the node itself.
 * @param nodeId - the Notes node
 * @param nodes - every node of the patch
 * @param edges - every cable of the patch
 * @returns the sound name, or an empty string when nothing sets one
 */
export const findStrudelFlowNotesSound = (
  nodeId: string,
  nodes: StrudelFlowNode[],
  edges: StrudelFlowEdge[]
): string => {
  const voiceSound = downstreamVoiceSound(nodeId, nodes, edges, new Set([nodeId]))
  return voiceSound.length > 0 ? voiceSound : ownSoundCall(nodes.find((node) => node.id === nodeId))
}
