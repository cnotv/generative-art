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
