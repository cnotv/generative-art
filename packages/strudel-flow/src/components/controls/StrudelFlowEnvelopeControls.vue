<script setup lang="ts">
import StrudelFlowKnob from './StrudelFlowKnob.vue'
import type { StrudelFlowEnvelopeData } from '../../types'

const props = defineProps<{
  data: StrudelFlowEnvelopeData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowEnvelopeData]
}>()

const update = (patch: Partial<StrudelFlowEnvelopeData>): void => {
  emit('update', { ...props.data, ...patch })
}
</script>

<template>
  <div class="strudel-flow-knobs">
    <StrudelFlowKnob
      label="Attack"
      :model-value="data.attack"
      :min="0"
      :max="2"
      :step="0.01"
      @update:model-value="update({ attack: $event })"
    />
    <StrudelFlowKnob
      label="Decay"
      :model-value="data.decay"
      :min="0"
      :max="2"
      :step="0.01"
      @update:model-value="update({ decay: $event })"
    />
    <StrudelFlowKnob
      label="Sustain"
      :model-value="data.sustain"
      :min="0"
      :max="1"
      :step="0.01"
      @update:model-value="update({ sustain: $event })"
    />
    <StrudelFlowKnob
      label="Release"
      :model-value="data.release"
      :min="0"
      :max="2"
      :step="0.01"
      @update:model-value="update({ release: $event })"
    />
  </div>
</template>
