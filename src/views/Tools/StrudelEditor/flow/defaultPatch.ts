import { STRUDEL_FLOW_DEFAULT_BEATS_PER_MINUTE } from './config'
import { createStrudelFlowNodeData } from './nodeDefaults'
import type { StrudelFlowPatch } from './types'

/**
 * The patch a first visit opens, and what Reset returns to: a pad running into a filter.
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
      id: 'filter-starter',
      type: 'strudel',
      position: { x: 500, y: 120 },
      data: createStrudelFlowNodeData('filter')
    }
  ],
  edges: [
    {
      id: 'pad-starter-filter-starter',
      source: 'pad-starter',
      target: 'filter-starter'
    }
  ],
  beatsPerMinute: STRUDEL_FLOW_DEFAULT_BEATS_PER_MINUTE
})
