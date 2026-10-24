<script setup lang="ts">
import { computed } from 'vue'
import { Slider } from '@/components/ui/slider'
import { formatStrudelFlowNumber } from '../nodePatterns'

const props = defineProps<{
  label: string
  modelValue: number
  min: number
  max: number
  step: number
  suffix?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const formattedValue = computed(() => formatStrudelFlowNumber(props.modelValue))

const onSliderUpdate = (values: number[]): void => {
  const nextValue = values[0]
  if (nextValue !== undefined) {
    emit('update:modelValue', nextValue)
  }
}
</script>

<template>
  <div class="strudel-flow-slider">
    <div class="strudel-flow-slider__header">
      <span class="strudel-flow-field__label">{{ label }}</span>
      <span class="strudel-flow-slider__value">{{ formattedValue }}{{ suffix ?? '' }}</span>
    </div>
    <Slider
      :model-value="[modelValue]"
      :min="min"
      :max="max"
      :step="step"
      @update:model-value="onSliderUpdate"
    />
  </div>
</template>
