<script setup lang="ts">
import { STRUDEL_FLOW_VISUAL_OPTIONS, STRUDEL_FLOW_VISUAL_PLACEMENT_OPTIONS } from '../../config'
import type { StrudelFlowVisualizerData } from '../../types'
import StrudelFlowSelect from './StrudelFlowSelect.vue'

const props = defineProps<{
  data: StrudelFlowVisualizerData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowVisualizerData]
}>()

const update = (patch: Partial<StrudelFlowVisualizerData>): void => {
  emit('update', { ...props.data, ...patch })
}

const onVisualChange = (value: string): void => {
  const option = STRUDEL_FLOW_VISUAL_OPTIONS.find((candidate) => candidate.value === value)
  if (option !== undefined) {
    update({ visual: option.value })
  }
}

const onOptionsInput = (event: Event): void => {
  if (event.target instanceof HTMLInputElement) {
    update({ options: event.target.value })
  }
}
</script>

<template>
  <div class="strudel-flow-visualizer">
    <StrudelFlowSelect
      label="Type"
      :model-value="data.visual"
      :options="STRUDEL_FLOW_VISUAL_OPTIONS"
      @update:model-value="onVisualChange"
    />
    <div class="strudel-flow-field">
      <span class="strudel-flow-field__label">Draw</span>
      <div class="strudel-flow-mode" role="group" aria-label="Where the visual draws">
        <button
          v-for="placement in STRUDEL_FLOW_VISUAL_PLACEMENT_OPTIONS"
          :key="placement.value"
          type="button"
          class="strudel-flow-mode__button nodrag"
          :class="{ 'strudel-flow-mode__button--active': data.placement === placement.value }"
          :aria-pressed="data.placement === placement.value"
          @click="update({ placement: placement.value === 'background' ? 'background' : 'inline' })"
        >
          {{ placement.label }}
        </button>
      </div>
    </div>
    <label class="strudel-flow-field">
      <span class="strudel-flow-field__label">Options</span>
      <input
        class="input nodrag"
        :value="data.options"
        placeholder="{ labels: 1 }"
        aria-label="Visual options"
        spellcheck="false"
        @input="onOptionsInput"
      />
    </label>
    <p class="strudel-flow-visualizer__hint">
      Draws in the code editor; switch to Code to watch it.
    </p>
  </div>
</template>
