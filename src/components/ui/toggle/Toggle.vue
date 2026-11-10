<script setup lang="ts">
import { Toggle as RadixToggle } from 'radix-vue'

/**
 * A button that stays pressed until pressed again, sized like `IconButton` so it can sit in
 * the same toolbar. Pressed reads as a quieter fill than hover, with the full foreground colour,
 * so hovering a pressed toggle still shows where the pointer is.
 */
withDefaults(
  defineProps<{
    modelValue?: boolean
    disabled?: boolean
    size?: 'sm' | 'md'
  }>(),
  { modelValue: false, disabled: false, size: 'md' }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <RadixToggle
    class="toggle"
    :class="`toggle--${size}`"
    :pressed="modelValue"
    :disabled="disabled"
    @update:pressed="emit('update:modelValue', $event)"
  >
    <slot />
  </RadixToggle>
</template>

<style scoped>
.toggle {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-md);
  background-color: transparent;
  color: var(--color-muted-foreground);
  cursor: pointer;
  transition: background-color 150ms;
}

.toggle--sm {
  min-width: var(--btn-sm-height);
  height: var(--btn-sm-height);
  font-size: var(--font-size-base);
}

.toggle--md {
  min-width: var(--btn-md-height);
  height: var(--btn-md-height);
  font-size: var(--font-size-md);
}

.toggle :slotted(svg) {
  width: 1em;
  height: 1em;
}

.toggle[data-state='on'] {
  background-color: var(--panel-item-bg-hover);
  color: var(--color-foreground);
}

.toggle:hover {
  background-color: var(--panel-item-bg-selected);
  color: var(--color-foreground);
}

.toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-ring);
}

.toggle:disabled {
  pointer-events: none;
  opacity: var(--opacity-muted);
}
</style>
