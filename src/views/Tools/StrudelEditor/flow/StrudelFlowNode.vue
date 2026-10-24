<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { X } from 'lucide-vue-next'
import IconButton from '@/components/IconButton.vue'
import StrudelFlowBeatsControls from './controls/StrudelFlowBeatsControls.vue'
import StrudelFlowChordsControls from './controls/StrudelFlowChordsControls.vue'
import StrudelFlowCodeControls from './controls/StrudelFlowCodeControls.vue'
import StrudelFlowDelayControls from './controls/StrudelFlowDelayControls.vue'
import StrudelFlowFilterControls from './controls/StrudelFlowFilterControls.vue'
import StrudelFlowPadControls from './controls/StrudelFlowPadControls.vue'
import StrudelFlowSpaceControls from './controls/StrudelFlowSpaceControls.vue'
import { getStrudelFlowNodeCategory, isStrudelFlowInstrumentKind } from './nodeDefaults'
import { getStrudelFlowNodeDefinition } from './nodeDefinitions'
import type { StrudelFlowNodeData } from './types'

const props = defineProps<{
  id: string
  data: StrudelFlowNodeData
  selected?: boolean
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowNodeData]
  remove: [nodeId: string]
}>()

const definition = computed(() => getStrudelFlowNodeDefinition(props.data.kind))
const category = computed(() => getStrudelFlowNodeCategory(props.data.kind))
const isInstrument = computed(() => isStrudelFlowInstrumentKind(props.data.kind))
const inputLabel = computed(() => `${definition.value.title} pattern input`)
const outputLabel = computed(() => `${definition.value.title} pattern output`)
const removeLabel = computed(() => `Remove ${definition.value.title} node`)

const onDataUpdate = (data: StrudelFlowNodeData): void => {
  emit('update', data)
}

const onRemove = (): void => {
  emit('remove', props.id)
}
</script>

<template>
  <article
    class="strudel-flow-node"
    :class="{ 'strudel-flow-node--selected': selected }"
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
      <div class="strudel-flow-node__title-group">
        <h3 class="strudel-flow-node__title">{{ definition.title }}</h3>
        <span class="strudel-flow-node__badge">{{ category }}</span>
      </div>
      <IconButton
        class="strudel-flow-node__remove nodrag"
        size="xs"
        :title="removeLabel"
        :aria-label="removeLabel"
        @pointerdown.stop
        @click.stop="onRemove"
      >
        <X aria-hidden="true" />
      </IconButton>
    </header>
    <div class="strudel-flow-node__body nodrag">
      <StrudelFlowPadControls v-if="data.kind === 'pad'" :data="data" @update="onDataUpdate" />
      <StrudelFlowBeatsControls
        v-else-if="data.kind === 'beats'"
        :data="data"
        @update="onDataUpdate"
      />
      <StrudelFlowChordsControls
        v-else-if="data.kind === 'chords'"
        :data="data"
        @update="onDataUpdate"
      />
      <StrudelFlowCodeControls
        v-else-if="data.kind === 'code'"
        :data="data"
        @update="onDataUpdate"
      />
      <StrudelFlowFilterControls
        v-else-if="data.kind === 'filter'"
        :data="data"
        @update="onDataUpdate"
      />
      <StrudelFlowDelayControls
        v-else-if="data.kind === 'delay'"
        :data="data"
        @update="onDataUpdate"
      />
      <StrudelFlowSpaceControls v-else :data="data" @update="onDataUpdate" />
    </div>
    <Handle
      type="source"
      :position="Position.Right"
      class="strudel-flow-node__handle strudel-flow-node__handle--output"
      :aria-label="outputLabel"
    />
  </article>
</template>
