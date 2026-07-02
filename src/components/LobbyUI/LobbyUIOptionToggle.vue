<script setup lang="ts">
import type { Component } from 'vue'

type Option = { value: string; label: string; icon?: Component }

withDefaults(
  defineProps<{
    modelValue: string
    options: Option[]
    size?: 'sm' | 'md'
    hideLabelOnMobile?: boolean
  }>(),
  { size: 'md', hideLabelOnMobile: false }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div
    class="lui-toggle"
    :class="[`lui-toggle--${size}`, { 'lui-toggle--hide-label-mobile': hideLabelOnMobile }]"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      class="lui-toggle__btn"
      :class="{ 'lui-toggle__btn--active': modelValue === opt.value }"
      type="button"
      :title="opt.label"
      @click="emit('update:modelValue', opt.value)"
    >
      <component :is="opt.icon" v-if="opt.icon" class="lui-toggle__icon" />
      <span class="lui-toggle__label">{{ opt.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.lui-toggle {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
}

.lui-toggle__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid transparent;
  border-radius: var(--radius-xl, 1.25rem);
  background: transparent;
  color: var(--lui-text-color);
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-medium);
  text-shadow: var(--lui-text-shadow);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: background-color 0.15s ease;
  opacity: 0.65;
}

.lui-toggle--sm .lui-toggle__btn {
  font-size: var(--lui-text-small);
  padding: var(--spacing-1) var(--spacing-2);
}

.lui-toggle__icon {
  width: 1.2em;
  height: 1.2em;
  filter: drop-shadow(2px 2px 0 #000);
}

.lui-toggle__btn--active {
  background: rgb(255 255 255 / 0.22);
  opacity: 1;
}

.lui-toggle__btn:hover {
  color: var(--lui-focus-color);
  opacity: 1;
}

.lui-toggle__btn:focus,
.lui-toggle__btn:focus-visible {
  outline: none;
  color: var(--lui-focus-color);
  border-color: var(--lui-focus-color);
  opacity: 1;
}

@media (width <= 480px) {
  .lui-toggle--hide-label-mobile .lui-toggle__label {
    display: none;
  }
}
</style>
