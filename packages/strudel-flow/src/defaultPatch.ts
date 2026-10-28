import {
  STRUDEL_FLOW_DEFAULT_BEATS_PER_CYCLE,
  STRUDEL_FLOW_DEFAULT_BEATS_PER_MINUTE
} from './config'
import { createStrudelFlowNodeData } from './nodeDefaults'
import type { StrudelFlowPatch } from './types'

/**
 * The patch a first visit opens, and what Reset returns to: a pad played by a voice through a
 * filter, as the reference editor starts.
 * @returns a fresh patch whose nodes and arrays can be edited without touching another copy
 */
export const createDefaultStrudelFlowPatch = (): StrudelFlowPatch => ({
  nodes: [
    {
      id: 'pad-starter',
      type: 'strudel',
      position: { x: 80, y: 120 },
      data: createStrudelFlowNodeData('pad')
    },
    {
      id: 'voice-starter',
      type: 'strudel',
      position: { x: 640, y: 120 },
      data: createStrudelFlowNodeData('voice')
    },
    {
      id: 'filter-starter',
      type: 'strudel',
      position: { x: 640, y: 420 },
      data: createStrudelFlowNodeData('filter')
    }
  ],
  edges: [
    { id: 'pad-starter-voice-starter', source: 'pad-starter', target: 'voice-starter' },
    { id: 'voice-starter-filter-starter', source: 'voice-starter', target: 'filter-starter' }
  ],
  beatsPerMinute: STRUDEL_FLOW_DEFAULT_BEATS_PER_MINUTE,
  beatsPerCycle: STRUDEL_FLOW_DEFAULT_BEATS_PER_CYCLE,
  setup: ''
})
