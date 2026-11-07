<script setup lang="ts">
import StrudelFlowKnob from './StrudelFlowKnob.vue'
import type { StrudelFlowSlowData } from '../../types'

const props = defineProps<{
  data: StrudelFlowSlowData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowSlowData]
}>()
</script>

<template>
  <div class="strudel-flow-knobs">
    <StrudelFlowKnob
      label="Slower by"
      :model-value="props.data.amount"
      :min="0.25"
      :max="8"
      :step="0.25"
      suffix="×"
      @update:model-value="emit('update', { ...props.data, amount: $event })"
    />
  </div>
</template>
