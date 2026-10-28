<script setup lang="ts">
import { computed } from 'vue'
import { formatStrudelFlowKnobValue } from '../../nodePatterns'

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
const CENTER = 50
const TRACK_RADIUS = 46

const pointOnCircle = (radius: number, angle: number): string => {
  const radians = (angle * Math.PI) / 180
  return `${CENTER + radius * Math.sin(radians)} ${CENTER - radius * Math.cos(radians)}`
}

// The full sweep, from the bottom left round the top to the bottom right.
const TRACK_PATH = `M ${pointOnCircle(TRACK_RADIUS, KNOB_START_ANGLE)} A ${TRACK_RADIUS} ${TRACK_RADIUS} 0 1 1 ${pointOnCircle(
  TRACK_RADIUS,
  KNOB_START_ANGLE + KNOB_ANGLE_RANGE
)}`

const valueRatio = computed(() => {
  const range = props.max - props.min
  if (range <= 0) {
    return 0
  }
  return Math.min(1, Math.max(0, (props.modelValue - props.min) / range))
})

const indicatorAngle = computed(() => KNOB_START_ANGLE + valueRatio.value * KNOB_ANGLE_RANGE)
const displayedValue = computed(() => formatStrudelFlowKnobValue(props.modelValue))
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
      <svg class="strudel-flow-knob__graphic" viewBox="0 0 100 100" aria-hidden="true">
        <path class="strudel-flow-knob__track" :d="TRACK_PATH" />
        <path
          class="strudel-flow-knob__fill"
          :d="TRACK_PATH"
          pathLength="100"
          :stroke-dasharray="`${valueRatio * 100} 100`"
        />
        <circle class="strudel-flow-knob__face" cx="50" cy="50" r="38" />
        <line
          class="strudel-flow-knob__indicator"
          x1="50"
          y1="41"
          x2="50"
          y2="28"
          :transform="`rotate(${indicatorAngle} 50 50)`"
        />
      </svg>
      <input
        class="strudel-flow-knob__input"
        type="range"
        :value="modelValue"
        :min="min"
        :max="max"
        :step="step"
        :aria-label="label"
        :aria-valuetext="`${displayedValue}${unit}`"
        @input="onInput"
      />
    </span>
    <span class="strudel-flow-knob__value">{{ displayedValue }}</span>
    <span class="strudel-flow-knob__label">{{ label }}</span>
  </label>
</template>
