<script setup lang="ts">
import { Toggle as RadixToggle } from 'radix-vue';
import { computed } from 'vue';
import { cn } from '@/lib/utilities';

const props = defineProps<{
  modelValue?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg';
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const variantClasses = {
  default: 'bg-transparent hover:bg-muted hover:text-muted-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
  outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
};

const sizeClasses = {
  default: 'h-10 px-3',
  sm: 'h-9 px-2.5',
  lg: 'h-11 px-5',
};

const classes = computed(() =>
  cn(
    'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    variantClasses[props.variant || 'default'],
    sizeClasses[props.size || 'default']
  )
);
</script>

<template>
  <RadixToggle
    :pressed="modelValue"
    :disabled="disabled"
    :class="classes"
    @update:pressed="emit('update:modelValue', $event)"
  >
    <slot />
  </RadixToggle>
</template>
