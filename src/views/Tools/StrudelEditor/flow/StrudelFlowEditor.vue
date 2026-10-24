<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { VueFlow } from '@vue-flow/core'
import type { Connection } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import './flowCanvas.scss'
import StrudelFlowNode from './StrudelFlowNode.vue'
import { canUseStrudelFlowConnection } from './connections'
import type {
  StrudelFlowEdge,
  StrudelFlowNode as StrudelFlowNodeType,
  StrudelFlowNodeData
} from './types'

const props = defineProps<{
  nodes: StrudelFlowNodeType[]
  edges: StrudelFlowEdge[]
}>()

const emit = defineEmits<{
  'update:nodes': [nodes: StrudelFlowNodeType[]]
  'update:edges': [edges: StrudelFlowEdge[]]
  connect: [sourceNodeId: string, targetNodeId: string]
  'update-node': [nodeId: string, data: StrudelFlowNodeData]
  'remove-node': [nodeId: string]
}>()

const DEFAULT_EDGE_OPTIONS = { type: 'smoothstep' }
const DELETE_KEYS = ['Backspace', 'Delete']

const isValidConnection = (connection: Connection): boolean =>
  canUseStrudelFlowConnection(connection, props.nodes, props.edges)

const onConnect = (connection: Connection): void => {
  if (isValidConnection(connection)) {
    emit('connect', connection.source, connection.target)
  }
}

const onNodesUpdated = (nodes: StrudelFlowNodeType[]): void => {
  emit('update:nodes', nodes)
}

const onEdgesUpdated = (edges: StrudelFlowEdge[]): void => {
  emit('update:edges', edges)
}

const onNodeUpdated = (nodeId: string, data: StrudelFlowNodeData): void => {
  emit('update-node', nodeId, data)
}

const onNodeRemoved = (nodeId: string): void => {
  emit('remove-node', nodeId)
}
</script>

<template>
  <VueFlow
    class="strudel-flow-editor"
    :nodes="nodes"
    :edges="edges"
    :default-edge-options="DEFAULT_EDGE_OPTIONS"
    :delete-key-code="DELETE_KEYS"
    :edges-updatable="false"
    :fit-view-on-init="true"
    :connect-on-click="true"
    :is-valid-connection="isValidConnection"
    :min-zoom="0.2"
    :max-zoom="2"
    @update:nodes="onNodesUpdated"
    @update:edges="onEdgesUpdated"
    @connect="onConnect"
  >
    <Background variant="dots" :gap="20" :size="1.4" color="var(--color-border)" />
    <Controls />
    <template #node-strudel="nodeProperties">
      <StrudelFlowNode
        :id="nodeProperties.id"
        :data="nodeProperties.data"
        :selected="nodeProperties.selected"
        @update="onNodeUpdated(nodeProperties.id, $event)"
        @remove="onNodeRemoved"
      />
    </template>
  </VueFlow>
</template>
