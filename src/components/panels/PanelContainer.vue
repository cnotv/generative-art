<script setup lang="ts">
defineProps<{
  side: 'left' | 'right';
}>();
</script>

<template>
  <div
    :id="side === 'left' ? 'left-panels' : 'right-panels'"
    class="panel-container"
    :class="`panel-container--${side}`"
  />
</template>

<style lang="scss">
@import '@/assets/styles/variables';

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.panel-ui {
  background-color: var(--color-background);
  color: var(--color-foreground);

  * {
    border-color: var(--color-border);
  }
}

.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background-color: rgba(0, 0, 0, 0.01);
  cursor: pointer;

  &[data-state='open'] {
    animation: fadeIn 150ms ease-out;
  }

  &[data-state='closed'] {
    animation: fadeOut 150ms ease-in;
  }
}

.panel-container {
  position: fixed;
  top: var(--nav-height);
  height: calc(100% - var(--nav-height));
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  align-items: flex-start;
  z-index: calc(var(--z-overlay) + 1);
  pointer-events: none;

  > * {
    pointer-events: auto;
  }
}

.panel-container--right {
  right: 0;
}

.panel-container--left {
  left: 0;
}

.sheet-content {
  position: relative;
  flex: 0 0 auto;
  max-height: 100%;
  gap: var(--spacing-1);
  background-color: var(--color-background);
  padding: var(--spacing-2);
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;

  &--left {
    width: var(--panel-width, 20rem);
    border-right: 1px solid var(--color-border);
  }

  &--right {
    width: var(--panel-width, 20rem);
    border-left: 1px solid var(--color-border);
  }
}

.sheet-close {
  position: absolute;
  right: var(--spacing-3);
  top: var(--spacing-3);
  background: transparent;
  border: none;
  padding: var(--spacing-1);
  opacity: 0.5;
  transition: opacity 150ms;
  cursor: pointer;

  &:hover {
    opacity: 1;
  }

  &:focus {
    outline: none;
  }

  svg {
    width: 1rem;
    height: 1rem;
    stroke: var(--color-foreground);
    stroke-width: 2;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes accordionDown {
  from {
    height: 0;
  }
  to {
    height: var(--radix-accordion-content-height);
  }
}

@keyframes accordionUp {
  from {
    height: var(--radix-accordion-content-height);
  }
  to {
    height: 0;
  }
}
</style>
