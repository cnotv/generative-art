<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Controls } from '@vue-flow/controls'
import { VueFlow } from '@vue-flow/core'
import type { Connection, VueFlowStore } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '../styles/flowCanvas.scss'
import StrudelFlowNode from './StrudelFlowNode.vue'
import StrudelFlowRadialMenu from './StrudelFlowRadialMenu.vue'
import StrudelFlowToolbar from './StrudelFlowToolbar.vue'
import { STRUDEL_FLOW_REFERENCE } from '../config'
import { canUseStrudelFlowConnection } from '../connections'
import type {
  StrudelFlowEdge,
  StrudelFlowNode as StrudelFlowNodeType,
  StrudelFlowNodeData,
  StrudelFlowNodeKind,
  StrudelFlowSampleGroup
} from '../types'

const props = defineProps<{
  nodes: StrudelFlowNodeType[]
  edges: StrudelFlowEdge[]
  beatsPerMinute: number
  beatsPerCycle: number
  /** Every sample the host can play, for the Samples and Beats nodes to pick from. */
  sampleGroups?: StrudelFlowSampleGroup[]
}>()

const emit = defineEmits<{
  'update:nodes': [nodes: StrudelFlowNodeType[]]
  'update:edges': [edges: StrudelFlowEdge[]]
  connect: [sourceNodeId: string, targetNodeId: string]
  'update-node': [nodeId: string, data: StrudelFlowNodeData]
  'remove-node': [nodeId: string]
  'add-node': [kind: StrudelFlowNodeKind]
  'update:beatsPerMinute': [beatsPerMinute: number]
  'update:beatsPerCycle': [beatsPerCycle: number]
}>()

const DEFAULT_EDGE_OPTIONS = { type: 'default' }

const radialMenu = ref<{ open: () => void } | null>(null)
const flowStore = ref<VueFlowStore | null>(null)
const fitAfterNodesMeasured = ref(false)
const DELETE_KEYS = ['Backspace', 'Delete']

// A node added by the palette or the radial menu may land below the fold; frame it for the user.
watch(
  () => props.nodes.length,
  (length, previousLength) => {
    if (length <= previousLength) {
      return
    }
    fitAfterNodesMeasured.value = true
    void nextTick(() => flowStore.value?.fitView({ padding: 0.2 }))
  }
)

const onPaneReady = (store: VueFlowStore): void => {
  flowStore.value = store
}

const onNodesInitialized = (): void => {
  if (!fitAfterNodesMeasured.value) {
    return
  }
  fitAfterNodesMeasured.value = false
  void flowStore.value?.fitView({ padding: 0.2 })
}

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

const onAddNode = (kind: StrudelFlowNodeKind): void => {
  emit('add-node', kind)
}

const openRadialMenu = (): void => {
  radialMenu.value?.open()
}
</script>

<template>
  <div class="strudel-flow-editor-shell" @contextmenu.prevent="openRadialMenu">
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
      @pane-ready="onPaneReady"
      @nodes-initialized="onNodesInitialized"
    >
      <Controls />
      <template #node-strudel="nodeProperties">
        <StrudelFlowNode
          :id="nodeProperties.id"
          :data="nodeProperties.data"
          :selected="nodeProperties.selected"
          :sample-groups="sampleGroups ?? []"
          @update="onNodeUpdated(nodeProperties.id, $event)"
          @remove="onNodeRemoved"
        />
      </template>
    </VueFlow>
    <StrudelFlowToolbar
      :beats-per-minute="beatsPerMinute"
      :beats-per-cycle="beatsPerCycle"
      @update:beats-per-minute="emit('update:beatsPerMinute', $event)"
      @update:beats-per-cycle="emit('update:beatsPerCycle', $event)"
    />
    <StrudelFlowRadialMenu ref="radialMenu" @add="onAddNode" />
    <p class="strudel-flow-credit">
      After
      <a :href="STRUDEL_FLOW_REFERENCE.url" target="_blank" rel="noopener">
        {{ STRUDEL_FLOW_REFERENCE.name }}
      </a>
      by
      <a :href="STRUDEL_FLOW_REFERENCE.authorUrl" target="_blank" rel="noopener">
        {{ STRUDEL_FLOW_REFERENCE.author }}
      </a>
    </p>
  </div>
</template>
