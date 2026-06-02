<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'cta' | 'primary' | 'ghost'
    disabled?: boolean
    autofocus?: boolean
  }>(),
  { variant: 'primary', disabled: false, autofocus: false }
)
</script>

<template>
  <button
    class="lui-btn"
    :class="`lui-btn--${variant}`"
    type="button"
    :disabled="disabled"
    :autofocus="autofocus"
  >
    <slot />
  </button>
</template>

<style scoped>
.lui-btn {
  padding: var(--spacing-2) var(--spacing-4);
  border: 2px solid transparent;
  background: transparent;
  color: var(--lui-text-color);
  font-family: var(--lui-font);
  font-weight: 900;
  text-shadow: var(--lui-text-shadow);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: opacity 0.15s ease;
}

.lui-btn--cta {
  border-color: var(--lui-stroke);
  box-shadow: var(--lui-border-shadow);
  font-size: var(--lui-text-important);
  padding: var(--spacing-2) var(--spacing-5, 1.5rem);
}

.lui-btn--primary {
  border-color: var(--lui-stroke);
  box-shadow: var(--lui-border-shadow);
  font-size: var(--lui-text-medium);
}

.lui-btn--ghost {
  border-color: transparent;
  font-size: var(--lui-text-medium);
}

.lui-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.lui-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.lui-btn:focus,
.lui-btn:focus-visible {
  outline: 3px solid #ffd700;
  outline-offset: 4px;
}
</style>
