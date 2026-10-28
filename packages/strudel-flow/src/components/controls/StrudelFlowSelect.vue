<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'

defineProps<{
  label: string
  modelValue: string
  options?: { value: string; label: string }[]
  /** Options in labelled groups, drawn as optgroups instead of a flat list. */
  groups?: { label: string; options: { value: string; label: string }[] }[]
  /** Keeps the label for assistive technology only, when the row already says what it is. */
  hideLabel?: boolean
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
    <span
      class="strudel-flow-field__label"
      :class="{ 'strudel-flow-field__label--hidden': hideLabel }"
    >
      {{ label }}
    </span>
    <span class="strudel-flow-select">
      <select :value="modelValue" :aria-label="label" class="nodrag" @change="onChange">
        <option v-for="option in options ?? []" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
        <optgroup v-for="group in groups ?? []" :key="group.label" :label="group.label">
          <option v-for="option in group.options" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </optgroup>
      </select>
      <ChevronDown class="strudel-flow-select__chevron" aria-hidden="true" />
    </span>
  </label>
</template>
