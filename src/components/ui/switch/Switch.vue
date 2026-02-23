<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'radix-vue';

defineProps<{
  modelValue?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<template>
  <SwitchRoot
    :id="id"
    :name="name"
    :checked="modelValue"
    :disabled="disabled"
    class="switch"
    @update:checked="emit('update:modelValue', $event)"
  >
    <SwitchThumb class="switch__thumb" />
  </SwitchRoot>
</template>

<style scoped>
.switch {
  display: inline-flex;
  height: 20px;
  width: 36px;
  flex-shrink: 0;
  cursor: pointer;
  align-items: center;
  border-radius: 9999px;
  border: none;
  transition: background-color 0.2s;
  outline: none;
  background-color: var(--color-muted);
}

.switch:focus-visible {
  box-shadow: 0 0 0 2px var(--color-ring);
}

.switch[data-state='checked'] {
  background-color: var(--color-primary);
}

.switch[data-disabled] {
  cursor: not-allowed;
  opacity: 0.5;
}

.switch__thumb {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 9999px;
  background-color: var(--color-background);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  transition: transform 0.2s;
  pointer-events: none;
}

.switch__thumb[data-state='checked'] {
  transform: translateX(16px);
}

.switch__thumb[data-state='unchecked'] {
  transform: translateX(2px);
}
</style>
