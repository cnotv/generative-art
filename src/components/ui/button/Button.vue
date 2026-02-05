<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/lib/utilities';

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    asChild?: boolean;
    class?: string;
  }>(),
  {
    variant: 'default',
    size: 'default',
    asChild: false,
  }
);

const variantClasses: Record<ButtonVariant, string> = {
  default: 'btn--default',
  destructive: 'btn--destructive',
  outline: 'btn--outline',
  secondary: 'btn--secondary',
  ghost: 'btn--ghost',
  link: 'btn--link',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: '',
  sm: 'btn--sm',
  lg: 'btn--lg',
  icon: 'btn--icon',
};

const classes = computed(() =>
  cn('btn', variantClasses[props.variant], sizeClasses[props.size], props.class)
);
</script>

<template>
  <button :class="classes">
    <slot />
  </button>
</template>
