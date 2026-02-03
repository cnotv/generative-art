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
