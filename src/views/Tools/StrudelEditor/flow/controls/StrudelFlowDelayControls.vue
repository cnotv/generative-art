<script setup lang="ts">
import StrudelFlowSliderField from './StrudelFlowSliderField.vue'
import type { StrudelFlowDelayData } from '../types'

const props = defineProps<{
  data: StrudelFlowDelayData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowDelayData]
}>()

const onMixChange = (mix: number): void => {
  emit('update', { ...props.data, mix })
}

const onTimeChange = (time: number): void => {
  emit('update', { ...props.data, time })
}

const onFeedbackChange = (feedback: number): void => {
  emit('update', { ...props.data, feedback })
}
</script>

<template>
  <div class="strudel-flow-controls">
    <StrudelFlowSliderField
      label="Mix"
      :model-value="data.mix"
      :min="0"
      :max="1"
      :step="0.01"
      @update:model-value="onMixChange"
    />
    <StrudelFlowSliderField
      label="Time"
      :model-value="data.time"
      :min="0"
      :max="1"
      :step="0.01"
      suffix=" s"
      @update:model-value="onTimeChange"
    />
    <StrudelFlowSliderField
      label="Feedback"
      :model-value="data.feedback"
      :min="0"
      :max="1"
      :step="0.01"
      @update:model-value="onFeedbackChange"
    />
  </div>
</template>
