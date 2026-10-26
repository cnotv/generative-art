<script setup lang="ts">
import { computed } from 'vue'
import { formatStrudelFlowNumber } from '../../nodePatterns'

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

const KNOB_START_ANGLE = -135
const KNOB_ANGLE_RANGE = 270

const valueRatio = computed(() => {
  const range = props.max - props.min
  if (range <= 0) {
    return 0
  }
  return Math.min(1, Math.max(0, (props.modelValue - props.min) / range))
})

const indicatorAngle = computed(() => KNOB_START_ANGLE + valueRatio.value * KNOB_ANGLE_RANGE)
const formattedValue = computed(() => formatStrudelFlowNumber(props.modelValue))
const unit = computed(() => props.suffix?.trim() ?? '')

const onInput = (event: Event): void => {
  const rangeInput = event.target
  if (rangeInput instanceof HTMLInputElement) {
    emit('update:modelValue', Number(rangeInput.value))
  }
}
</script>

<template>
  <label class="strudel-flow-knob">
    <span class="strudel-flow-knob__dial">
      <svg class="strudel-flow-knob__arc" viewBox="0 0 72 72" aria-hidden="true">
        <circle
          cx="36"
          cy="36"
          r="33"
          stroke-dasharray="24 183"
          :transform="`rotate(${indicatorAngle - 20} 36 36)`"
        />
      </svg>
      <span class="strudel-flow-knob__face">
        <span
          class="strudel-flow-knob__indicator"
          :style="{ transform: `rotate(${indicatorAngle}deg)` }"
        />
      </span>
      <input
        class="strudel-flow-knob__input"
        type="range"
        :value="modelValue"
        :min="min"
        :max="max"
        :step="step"
        :aria-label="label"
        :aria-valuetext="`${formattedValue}${unit}`"
        @input="onInput"
      />
    </span>
    <span class="strudel-flow-knob__value">
      {{ formattedValue
      }}<span v-if="unit.length > 0" class="strudel-flow-knob__unit">{{ unit }}</span>
    </span>
    <span class="strudel-flow-knob__label">{{ label }}</span>
  </label>
</template>
