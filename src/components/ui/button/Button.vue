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

<style>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 150ms;
  cursor: pointer;
  border: none;
}

.btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-ring);
}

.btn:disabled {
  pointer-events: none;
  opacity: 0.5;
}

.btn--default {
  background-color: var(--color-primary);
  color: var(--color-primary-foreground);
}

.btn--default:hover {
  opacity: 0.9;
}

.btn--destructive {
  background-color: var(--color-destructive);
  color: var(--color-destructive-foreground);
}

.btn--destructive:hover {
  opacity: 0.9;
}

.btn--outline {
  border: 1px solid var(--color-input);
  background-color: var(--color-background);
  color: var(--color-foreground);
}

.btn--outline:hover {
  background-color: var(--color-accent);
  color: var(--color-accent-foreground);
}

.btn--secondary {
  background-color: var(--color-secondary);
  color: var(--color-secondary-foreground);
}

.btn--secondary:hover {
  opacity: 0.8;
}

.btn--ghost {
  background-color: transparent;
  color: var(--color-foreground);
}

.btn--ghost:hover {
  background-color: var(--color-accent);
  color: var(--color-accent-foreground);
}

.btn--link {
  background-color: transparent;
  color: var(--color-primary);
  text-decoration: underline;
}

.btn--link:hover {
  text-decoration: none;
}

.btn--sm {
  height: 2.25rem;
  padding: 0 0.75rem;
}

.btn--lg {
  height: 2.75rem;
  padding: 0 2rem;
}

.btn--icon {
  height: 2.5rem;
  width: 2.5rem;
  padding: 0;
}
</style>
