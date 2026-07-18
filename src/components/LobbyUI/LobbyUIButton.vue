<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'cta' | 'primary' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
    autofocus?: boolean
    stacked?: boolean
  }>(),
  { variant: 'primary', size: 'md', disabled: false, autofocus: false, stacked: false }
)
</script>

<template>
  <button
    class="lui-btn"
    :class="[`lui-btn--${variant}`, `lui-btn--${size}`, { 'lui-btn--stacked': stacked }]"
    type="button"
    :disabled="disabled"
    :autofocus="autofocus"
  >
    <slot />
  </button>
</template>

<style scoped>
.lui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-1);
  padding-block: calc(var(--spacing-2) + 0.06em) calc(var(--spacing-2) - 0.06em);
  padding-inline: var(--spacing-4);
  border: 3px solid transparent;
  background: transparent;
  color: var(--lui-text-color);
  font-family: var(--lui-font);
  font-weight: 900;
  text-shadow: var(--lui-text-shadow);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: opacity 0.15s ease;
  border-radius: var(--lui-radius-sketch);
}

.lui-btn--cta {
  font-size: var(--lui-text-important);
  padding-inline: var(--spacing-5, 1.5rem);
}

.lui-btn--primary {
  font-size: var(--lui-text-medium);
}

.lui-btn--ghost {
  font-size: var(--lui-text-medium);
}

.lui-btn--sm {
  font-size: var(--lui-text-small);
  padding-block: calc(var(--spacing-1) + 0.06em) calc(var(--spacing-1) - 0.06em);
  padding-inline: var(--spacing-2);
}

.lui-btn--lg {
  font-size: var(--lui-text-important);
  padding-inline: var(--spacing-5, 1.5rem);
}

/* Icon tile: svg/icon stacked above a micro label, borderless — focus and
   hover feedback comes from the text/icon color alone. */
.lui-btn--stacked {
  flex-direction: column;
  gap: var(--spacing-1);
  padding: var(--spacing-1);
  font-size: var(--lui-text-micro);
  line-height: 1.1;
  border: none;
}

.lui-btn :slotted(svg) {
  flex-shrink: 0;
  width: 1.6em;
  height: 1.6em;
  filter: drop-shadow(2px 2px 0 #000);
}

.lui-btn--stacked :slotted(svg) {
  width: 2.4em;
  height: 2.4em;
}

.lui-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.lui-btn:hover:not(:disabled) {
  color: var(--lui-focus-color);
}

.lui-btn:focus,
.lui-btn:focus-visible {
  outline: none;
  color: var(--lui-focus-color);
  border-color: var(--lui-focus-color);
}
</style>
