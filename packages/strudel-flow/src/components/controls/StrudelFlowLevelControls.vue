<script setup lang="ts">
import StrudelFlowKnob from './StrudelFlowKnob.vue'
import type { StrudelFlowLevelData } from '../../types'

const props = defineProps<{
  data: StrudelFlowLevelData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowLevelData]
}>()

const update = (patch: Partial<StrudelFlowLevelData>): void => {
  emit('update', { ...props.data, ...patch })
}
</script>

<template>
  <div class="strudel-flow-knobs">
    <StrudelFlowKnob
      label="Gain"
      :model-value="data.gain"
      :min="0"
      :max="2"
      :step="0.01"
      suffix="×"
      @update:model-value="update({ gain: $event })"
    />
    <StrudelFlowKnob
      label="Pan"
      :model-value="data.pan"
      :min="0"
      :max="1"
      :step="0.01"
      @update:model-value="update({ pan: $event })"
    />
    <StrudelFlowKnob
      label="Postgain"
      :model-value="data.postgain"
      :min="0"
      :max="2"
      :step="0.01"
      suffix="×"
      @update:model-value="update({ postgain: $event })"
    />
  </div>
</template>
