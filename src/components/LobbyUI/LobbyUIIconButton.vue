<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost'
    size?: 'sm' | 'md'
    disabled?: boolean
  }>(),
  { variant: 'ghost', size: 'md', disabled: false }
)
</script>

<template>
  <button
    class="lui-icon-btn"
    :class="[`lui-icon-btn--${variant}`, `lui-icon-btn--${size}`]"
    type="button"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<style scoped>
.lui-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2em;
  height: 2.2em;
  padding: 0;
  border: 3px solid transparent;
  border-radius: 50%;
  background: transparent;
  color: var(--lui-text-color);
  cursor: pointer;
  line-height: 1;
  transition: color 0.15s ease;
}

.lui-icon-btn--sm {
  width: 1.9em;
  height: 1.9em;
  border-width: 2px;
}

.lui-icon-btn--primary {
  background: rgb(255 255 255 / 0.12);
}

.lui-icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.lui-icon-btn:hover:not(:disabled) {
  color: var(--lui-focus-color);
}

.lui-icon-btn:focus,
.lui-icon-btn:focus-visible {
  outline: none;
  color: var(--lui-focus-color);
  border-color: var(--lui-focus-color);
}
</style>
