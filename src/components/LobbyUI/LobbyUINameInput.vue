<script setup lang="ts">
defineProps<{
  modelValue: string
  placeholder?: string
  maxlength?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: []
  change: []
}>()

const onInput = (event: Event): void => {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <input
    :value="modelValue"
    type="text"
    class="lui-name-input"
    :placeholder="placeholder"
    :maxlength="maxlength"
    @input="onInput"
    @blur="emit('blur')"
    @change="emit('change')"
  />
</template>

<style scoped>
.lui-name-input {
  width: 100%;
  padding: var(--spacing-1) 0;
  border: none;
  border-bottom: 2px solid var(--lui-stroke-faint);
  background: transparent;
  color: var(--lui-text-color);
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-medium);
  text-shadow: var(--lui-text-shadow);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
  caret-color: var(--lui-stroke);
}

.lui-name-input::placeholder {
  color: var(--lui-text-color);
  opacity: 0.6;
  text-shadow: var(--lui-text-shadow);
}

.lui-name-input:hover {
  border-bottom-color: var(--lui-stroke);
}

.lui-name-input:focus,
.lui-name-input:focus-visible {
  outline: none;
  color: var(--lui-focus-color);
  border-bottom-color: var(--lui-focus-color);
  caret-color: var(--lui-focus-color);
}
</style>
