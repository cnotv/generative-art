<script setup lang="ts">
import { CheckboxRoot, CheckboxIndicator } from 'radix-vue';
import { cn } from '@/lib/utilities';
import { Check } from 'lucide-vue-next';

defineProps<{
  modelValue?: boolean;
  disabled?: boolean;
  id?: string;
  class?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<template>
  <CheckboxRoot
    :id="id"
    :checked="modelValue"
    :disabled="disabled"
    :class="cn('checkbox', $props.class)"
    @update:checked="emit('update:modelValue', $event)"
  >
    <CheckboxIndicator class="flex items-center justify-center">
      <Check class="h-4 w-4" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>

<style>
.checkbox {
  height: 1rem;
  width: 1rem;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-primary);
  background-color: transparent;
  cursor: pointer;
}

.checkbox:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-ring);
}

.checkbox:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.checkbox[data-state="checked"] {
  background-color: var(--color-primary);
  color: var(--color-primary-foreground);
}
</style>
