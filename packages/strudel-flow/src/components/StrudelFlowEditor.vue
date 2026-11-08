<script setup lang="ts">
import { computed, nextTick, provide, ref, shallowRef, watch } from 'vue'
import { Controls } from '@vue-flow/controls'
import { VueFlow } from '@vue-flow/core'
import type { Connection, VueFlowStore } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '../styles/flowCanvas.scss'
import StrudelFlowCable from './StrudelFlowCable.vue'
import StrudelFlowNode from './StrudelFlowNode.vue'
import StrudelFlowRadialMenu from './StrudelFlowRadialMenu.vue'
import StrudelFlowToolbar from './StrudelFlowToolbar.vue'
import { getStrudelFlowVisualizerWidgetIds } from '../compileStrudelFlow'
import { STRUDEL_FLOW_REFERENCE } from '../config'
import { STRUDEL_FLOW_OVERLAY_TARGET } from './overlayTargetKey'
import { STRUDEL_FLOW_PREVIEW_SOUND } from './previewSoundKey'
import { STRUDEL_FLOW_VISUALIZER_WIDGET_IDS } from './visualizerWidgetIdsKey'
import { STRUDEL_FLOW_NOTATION_CONTEXT } from './notation/notationContextKey'
import { findStrudelFlowNotesSound } from '../notationPick'
import { canUseStrudelFlowConnection } from '../connections'
import { separateStrudelFlowNodes } from '../layout'
import { isStrudelFlowSoloed, planStrudelFlowSolo } from '../solo'
import type {
  StrudelFlowEdge,
  StrudelFlowNode as StrudelFlowNodeType,
  StrudelFlowNodeData,
  StrudelFlowNodeKind,
  StrudelFlowNoteReader,
  StrudelFlowSampleGroup
} from '../types'

const props = defineProps<{
  nodes: StrudelFlowNodeType[]
  edges: StrudelFlowEdge[]
  beatsPerMinute: number
  beatsPerCycle: number
  /** Every sample the host can play, for the Samples and Beats nodes to pick from. */
  sampleGroups?: StrudelFlowSampleGroup[]
  /** Every synth and instrument the host can play, for the Voice node to pick from. */
  voiceGroups?: StrudelFlowSampleGroup[]
  /** Reads a Notes node's pattern into bars, for its notation; without it only the text shows. */
  noteReader?: StrudelFlowNoteReader
  /** Plays a sound by name when one is picked; without it picking is silent. */
  previewSound?: (soundName: string) => void
  /** The nodes whose notes sound now, outlined like the code editor outlines the playing token. */
  playingNodeIds?: string[]
}>()

const emit = defineEmits<{
  'update:nodes': [nodes: StrudelFlowNodeType[]]
  'update:edges': [edges: StrudelFlowEdge[]]
  connect: [sourceNodeId: string, targetNodeId: string]
  'update-node': [nodeId: string, data: StrudelFlowNodeData]
  'remove-node': [nodeId: string]
  'show-code': [nodeId: string]
  'add-node': [kind: StrudelFlowNodeKind]
  'update:beatsPerMinute': [beatsPerMinute: number]
  'update:beatsPerCycle': [beatsPerCycle: number]
}>()

const DEFAULT_EDGE_OPTIONS = { type: 'strudel' }

const shell = ref<HTMLElement | null>(null)
provide(STRUDEL_FLOW_OVERLAY_TARGET, shell)
provide(STRUDEL_FLOW_PREVIEW_SOUND, (soundName: string) => props.previewSound?.(soundName))

provide(
  STRUDEL_FLOW_VISUALIZER_WIDGET_IDS,
  computed(() => getStrudelFlowVisualizerWidgetIds(props.nodes, props.edges))
)

provide(
  STRUDEL_FLOW_NOTATION_CONTEXT,
  computed(() => ({
    readNoteBars: props.noteReader ?? null,
    beatsPerCycle: props.beatsPerCycle,
    soundOf: (nodeId: string) => findStrudelFlowNotesSound(nodeId, props.nodes, props.edges)
  }))
)

const radialMenu = ref<{ open: () => void } | null>(null)
// Shallow, so the store's own refs, such as its node list, stay refs.
const flowStore = shallowRef<VueFlowStore | null>(null)
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

// A node renders taller than the layout expected when it holds an open accordion or a long
// pattern, so once the canvas has measured them, anything left underneath moves clear.
const separateMeasuredNodes = (): void => {
  const measured = flowStore.value?.getNodes.value ?? []
  const separated = separateStrudelFlowNodes(measured)
  const hasMoved = separated.some(
    (node, index) =>
      node.position.x !== measured[index]?.position.x ||
      node.position.y !== measured[index]?.position.y
  )
  if (hasMoved) {
    emit('update:nodes', separated)
  }
}

const measuredSizes = computed(() =>
  (flowStore.value?.getNodes.value ?? [])
    .map((node) => `${node.dimensions.width}x${node.dimensions.height}`)
    .join()
)

watch(measuredSizes, () => nextTick(separateMeasuredNodes))

const onNodesInitialized = (): void => {
  separateMeasuredNodes()
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

const onNodeSoloed = (nodeId: string): void => {
  planStrudelFlowSolo(props.nodes, props.edges, nodeId).forEach((change) => {
    const target = props.nodes.find((node) => node.id === change.nodeId)
    if (target !== undefined) {
      emit('update-node', change.nodeId, { ...target.data, muted: change.muted })
    }
  })
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
  <div ref="shell" class="strudel-flow-editor-shell" @contextmenu.prevent="openRadialMenu">
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
          :voice-groups="voiceGroups ?? []"
          :is-soloed="isStrudelFlowSoloed(nodes, edges, nodeProperties.id)"
          :is-playing="playingNodeIds?.includes(nodeProperties.id) ?? false"
          @update="onNodeUpdated(nodeProperties.id, $event)"
          @solo="onNodeSoloed"
          @remove="onNodeRemoved"
          @show-code="emit('show-code', $event)"
        />
      </template>
      <template #edge-strudel="edgeProperties">
        <StrudelFlowCable v-bind="edgeProperties" />
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
