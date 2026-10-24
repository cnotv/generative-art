<script setup lang="ts">
import StrudelFlowSliderField from './StrudelFlowSliderField.vue'
import type { StrudelFlowFilterData } from '../types'

const props = defineProps<{
  data: StrudelFlowFilterData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowFilterData]
}>()

const onCutoffChange = (cutoff: number): void => {
  emit('update', { ...props.data, cutoff })
}

const onResonanceChange = (resonance: number): void => {
  emit('update', { ...props.data, resonance })
}
</script>

<template>
  <div class="strudel-flow-controls">
    <StrudelFlowSliderField
      label="Cutoff"
      :model-value="data.cutoff"
      :min="20"
      :max="20000"
      :step="10"
      suffix=" Hz"
      @update:model-value="onCutoffChange"
    />
    <StrudelFlowSliderField
      label="Resonance"
      :model-value="data.resonance"
      :min="0.1"
      :max="20"
      :step="0.1"
      @update:model-value="onResonanceChange"
    />
  </div>
</template>
