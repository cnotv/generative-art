<script setup lang="ts">
import StrudelFlowKnob from './StrudelFlowKnob.vue'
import type { StrudelFlowGainData } from '../../types'

const props = defineProps<{
  data: StrudelFlowGainData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowGainData]
}>()
</script>

<template>
  <div class="strudel-flow-knobs">
    <StrudelFlowKnob
      label="Gain"
      :model-value="props.data.gain"
      :min="0"
      :max="2"
      :step="0.01"
      suffix="×"
      @update:model-value="emit('update', { ...props.data, gain: $event })"
    />
  </div>
</template>
