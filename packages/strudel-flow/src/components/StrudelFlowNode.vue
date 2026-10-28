<script setup lang="ts">
import { computed, inject, markRaw, ref } from 'vue'
import type { Component } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Code2, Ellipsis, ListPlus, Trash2, Volume2, VolumeX } from 'lucide-vue-next'
import StrudelFlowBeatsControls from './controls/StrudelFlowBeatsControls.vue'
import StrudelFlowCallList from './controls/StrudelFlowCallList.vue'
import StrudelFlowChordsControls from './controls/StrudelFlowChordsControls.vue'
import StrudelFlowCodeControls from './controls/StrudelFlowCodeControls.vue'
import StrudelFlowDelayControls from './controls/StrudelFlowDelayControls.vue'
import StrudelFlowEnvelopeControls from './controls/StrudelFlowEnvelopeControls.vue'
import StrudelFlowFilterControls from './controls/StrudelFlowFilterControls.vue'
import StrudelFlowLevelControls from './controls/StrudelFlowLevelControls.vue'
import StrudelFlowPadControls from './controls/StrudelFlowPadControls.vue'
import StrudelFlowPatternControls from './controls/StrudelFlowPatternControls.vue'
import StrudelFlowVisualizerControls from './controls/StrudelFlowVisualizerControls.vue'
import StrudelFlowVisualPreview from './controls/StrudelFlowVisualPreview.vue'
import StrudelFlowSpaceControls from './controls/StrudelFlowSpaceControls.vue'
import StrudelFlowVoiceControls from './controls/StrudelFlowVoiceControls.vue'
import { isStrudelFlowInstrumentKind } from '../nodeDefaults'
import { getStrudelFlowNodeDefinition } from '../nodeDefinitions'
import { generateStrudelFlowNodePattern } from '../nodePatterns'
import { STRUDEL_FLOW_VISUALIZER_WIDGET_IDS } from './visualizerWidgetIdsKey'
import type { StrudelFlowNodeData, StrudelFlowNodeKind, StrudelFlowSampleGroup } from '../types'

const props = defineProps<{
  id: string
  data: StrudelFlowNodeData
  selected?: boolean
  sampleGroups?: StrudelFlowSampleGroup[]
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowNodeData]
  remove: [nodeId: string]
}>()

// An Effect node is only its calls, which every node shows under its own controls.
const NODE_CONTROLS: Record<Exclude<StrudelFlowNodeKind, 'effect'>, Component> = {
  pad: markRaw(StrudelFlowPadControls),
  beats: markRaw(StrudelFlowBeatsControls),
  chords: markRaw(StrudelFlowChordsControls),
  notes: markRaw(StrudelFlowPatternControls),
  samples: markRaw(StrudelFlowPatternControls),
  code: markRaw(StrudelFlowCodeControls),
  voice: markRaw(StrudelFlowVoiceControls),
  filter: markRaw(StrudelFlowFilterControls),
  delay: markRaw(StrudelFlowDelayControls),
  space: markRaw(StrudelFlowSpaceControls),
  level: markRaw(StrudelFlowLevelControls),
  envelope: markRaw(StrudelFlowEnvelopeControls),
  visualizer: markRaw(StrudelFlowVisualizerControls)
}

const EFFECT_CODE_INPUT = 'pattern'
const SAMPLE_PICKING_KINDS = new Set<StrudelFlowNodeKind>(['samples', 'beats'])

const isMenuOpen = ref(false)
const isCodeVisible = ref(false)

const definition = computed(() => getStrudelFlowNodeDefinition(props.data.kind))
const title = computed(() => definition.value.title)
// Only the nodes that pick samples take the list; on any other it would land as an attribute.
const controlProperties = computed(() =>
  SAMPLE_PICKING_KINDS.has(props.data.kind) ? { sampleGroups: props.sampleGroups ?? [] } : {}
)
const visualizerWidgetIds = inject(STRUDEL_FLOW_VISUALIZER_WIDGET_IDS, null)
const visualWidgetId = computed(() => visualizerWidgetIds?.value[props.id] ?? null)
const hasCalls = computed(() => props.data.kind === 'effect' || (props.data.calls ?? []).length > 0)
// A visual only draws the pattern, so calls that change it go on another node.
const canTakeCalls = computed(
  () => props.data.kind !== 'effect' && props.data.kind !== 'visualizer'
)
const isInstrument = computed(() => isStrudelFlowInstrumentKind(props.data.kind))
const isMuted = computed(() => 'muted' in props.data && props.data.muted === true)
const inputLabel = computed(() => `${title.value} pattern input`)
const outputLabel = computed(() => `${title.value} pattern output`)
const muteLabel = computed(() => `${isMuted.value ? 'Unmute' : 'Mute'} ${title.value}`)
const nodeCode = computed(() =>
  generateStrudelFlowNodePattern(props.data, isInstrument.value ? '' : EFFECT_CODE_INPUT)
)

const onDataUpdate = (data: StrudelFlowNodeData): void => {
  emit('update', data)
}

const onMuteToggle = (): void => {
  emit('update', Object.assign({}, props.data, { muted: !isMuted.value }))
}

const onCodeToggle = (): void => {
  isCodeVisible.value = !isCodeVisible.value
  isMenuOpen.value = false
}

const onAddCall = (): void => {
  isMenuOpen.value = false
  emit(
    'update',
    Object.assign({}, props.data, {
      calls: [...(props.data.calls ?? []), { method: '', argument: '' }]
    })
  )
}

const onRemove = (): void => {
  isMenuOpen.value = false
  emit('remove', props.id)
}
</script>

<template>
  <article
    class="strudel-flow-node"
    :class="{
      'strudel-flow-node--selected': selected,
      'strudel-flow-node--muted': isMuted
    }"
    :data-node-kind="data.kind"
  >
    <Handle
      v-if="!isInstrument"
      type="target"
      :position="Position.Left"
      class="strudel-flow-node__handle strudel-flow-node__handle--input"
      :aria-label="inputLabel"
    />
    <header class="strudel-flow-node__header">
      <h3 class="strudel-flow-node__title">{{ title }}</h3>
      <button
        v-if="isInstrument"
        type="button"
        class="strudel-flow-node__action nodrag"
        :title="muteLabel"
        :aria-label="muteLabel"
        :aria-pressed="isMuted"
        @pointerdown.stop
        @click.stop="onMuteToggle"
      >
        <VolumeX v-if="isMuted" aria-hidden="true" />
        <Volume2 v-else aria-hidden="true" />
      </button>
      <button
        type="button"
        class="strudel-flow-node__action nodrag"
        :title="`${title} options`"
        :aria-label="`${title} options`"
        :aria-expanded="isMenuOpen"
        @pointerdown.stop
        @click.stop="isMenuOpen = !isMenuOpen"
        @keydown.escape="isMenuOpen = false"
      >
        <Ellipsis aria-hidden="true" />
      </button>
      <div v-if="isMenuOpen" class="strudel-flow-node__menu nodrag" role="menu">
        <button
          type="button"
          class="strudel-flow-node__menu-item"
          role="menuitem"
          @pointerdown.stop
          @click.stop="onCodeToggle"
        >
          <Code2 aria-hidden="true" />
          {{ isCodeVisible ? 'Hide code' : 'View code' }}
        </button>
        <button
          v-if="canTakeCalls"
          type="button"
          class="strudel-flow-node__menu-item"
          role="menuitem"
          @pointerdown.stop
          @click.stop="onAddCall"
        >
          <ListPlus aria-hidden="true" />
          Add call
        </button>
        <button
          type="button"
          class="strudel-flow-node__menu-item strudel-flow-node__menu-item--danger"
          role="menuitem"
          @pointerdown.stop
          @click.stop="onRemove"
        >
          <Trash2 aria-hidden="true" />
          Remove
        </button>
      </div>
    </header>
    <pre v-if="isCodeVisible" class="strudel-flow-node__code nodrag">{{ nodeCode }}</pre>
    <div class="strudel-flow-node__body nodrag">
      <StrudelFlowVisualPreview
        v-if="data.kind === 'visualizer'"
        :placement="data.placement"
        :widget-id="visualWidgetId"
      />
      <component
        :is="NODE_CONTROLS[data.kind]"
        v-if="data.kind !== 'effect'"
        :data="data"
        v-bind="controlProperties"
        @update="onDataUpdate"
      />
      <StrudelFlowCallList v-if="hasCalls" :data="data" @update="onDataUpdate" />
    </div>
    <Handle
      type="source"
      :position="Position.Right"
      class="strudel-flow-node__handle strudel-flow-node__handle--output"
      :aria-label="outputLabel"
    />
  </article>
</template>
