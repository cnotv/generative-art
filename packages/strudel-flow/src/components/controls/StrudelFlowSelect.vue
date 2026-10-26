<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'

defineProps<{
  label: string
  modelValue: string
  options: { value: string; label: string }[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const onChange = (event: Event): void => {
  const select = event.target
  if (select instanceof HTMLSelectElement) {
    emit('update:modelValue', select.value)
  }
}
</script>

<template>
  <label class="strudel-flow-field">
    <span class="strudel-flow-field__label">{{ label }}</span>
    <span class="strudel-flow-select">
      <select :value="modelValue" :aria-label="label" @change="onChange">
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <ChevronDown class="strudel-flow-select__chevron" aria-hidden="true" />
    </span>
  </label>
</template>
