<script setup lang="ts">
import { computed } from 'vue'
import { parseStrudelFlowSampleLayers, writeStrudelFlowSampleLayers } from '../../sampleSequence'
import type {
  StrudelFlowSampleGroup,
  StrudelFlowSampleLayer,
  StrudelFlowSamplesData
} from '../../types'
import StrudelFlowSampleSteps from './StrudelFlowSampleSteps.vue'

const props = defineProps<{
  data: StrudelFlowSamplesData
  sampleGroups?: StrudelFlowSampleGroup[]
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowSamplesData]
}>()

const layers = computed(() => parseStrudelFlowSampleLayers(props.data.pattern))

const update = (patch: Partial<StrudelFlowSamplesData>): void => {
  emit('update', { ...props.data, ...patch })
}

const onLayersUpdate = (nextLayers: StrudelFlowSampleLayer[]): void => {
  update({ pattern: writeStrudelFlowSampleLayers(nextLayers) })
}

const onPatternInput = (event: Event): void => {
  if (event.target instanceof HTMLTextAreaElement) {
    update({ pattern: event.target.value })
  }
}
</script>

<template>
  <StrudelFlowSampleSteps
    :layers="layers"
    :sample-groups="sampleGroups ?? []"
    @update:layers="onLayersUpdate"
  />
  <div class="strudel-flow-field strudel-flow-field--inline">
    <span class="strudel-flow-field__label">Mini notation</span>
    <button
      type="button"
      role="switch"
      class="strudel-flow-switch nodrag"
      :aria-checked="data.showPattern === true"
      aria-label="Show mini notation"
      @click="update({ showPattern: data.showPattern !== true })"
    >
      <span class="strudel-flow-switch__thumb" aria-hidden="true" />
    </button>
  </div>
  <textarea
    v-if="data.showPattern === true"
    class="strudel-flow-textarea"
    :value="data.pattern"
    aria-label="Samples pattern"
    rows="2"
    spellcheck="false"
    @input="onPatternInput"
  />
</template>
