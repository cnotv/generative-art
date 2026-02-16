<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'radix-vue';
import { computed } from 'vue';
import { cn } from '@/lib/utilities';

const props = defineProps<{
  modelValue?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const classes = computed(() =>
  cn(
    'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
    'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input'
  )
);

const thumbClasses = computed(() =>
  cn(
    'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
    'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
  )
);
</script>

<template>
  <SwitchRoot
    :id="id"
    :name="name"
    :checked="modelValue"
    :disabled="disabled"
    :class="classes"
    @update:checked="emit('update:modelValue', $event)"
  >
    <SwitchThumb :class="thumbClasses" />
  </SwitchRoot>
</template>
