<script setup lang="ts">
import { Minus, Plus } from 'lucide-vue-next'

const props = defineProps<{
  label: string
  modelValue: number
  min: number
  max: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const change = (delta: number): void => {
  emit('update:modelValue', Math.min(props.max, Math.max(props.min, props.modelValue + delta)))
}
</script>

<template>
  <div class="strudel-flow-field">
    <span class="strudel-flow-field__label">{{ label }}</span>
    <div class="strudel-flow-stepper" role="group" :aria-label="label">
      <button
        type="button"
        class="strudel-flow-stepper__button nodrag"
        :aria-label="`Decrease ${label.toLowerCase()}`"
        :disabled="modelValue <= min"
        @click="change(-1)"
      >
        <Minus aria-hidden="true" />
      </button>
      <output class="strudel-flow-stepper__value">{{ modelValue }}</output>
      <button
        type="button"
        class="strudel-flow-stepper__button nodrag"
        :aria-label="`Increase ${label.toLowerCase()}`"
        :disabled="modelValue >= max"
        @click="change(1)"
      >
        <Plus aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
