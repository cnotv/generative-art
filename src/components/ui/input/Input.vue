<script setup lang="ts">
import { cn } from '@/lib/utilities';

defineProps<{
  modelValue?: string | number;
  type?: 'text' | 'number' | 'password' | 'email';
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  class?: string;
  step?: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();
</script>

<template>
  <input
    :id="id"
    :type="type ?? 'text'"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :step="step"
    :class="cn('input', $props.class)"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<style>
.input {
  display: flex;
  height: 2.5rem;
  width: 100%;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-input);
  background-color: var(--color-background);
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: var(--color-foreground);
}

.input::placeholder {
  color: var(--color-muted-foreground);
}

.input:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-ring);
}

.input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
