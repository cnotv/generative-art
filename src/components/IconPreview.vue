<script setup lang="ts">
import type { Component } from 'vue'

interface Properties {
  icon: Component
  color?: string
  size?: 'sm' | 'md'
}

withDefaults(defineProps<Properties>(), {
  color: 'text-gray-400',
  size: 'md'
})
</script>

<template>
  <div class="icon-preview" :class="`icon-preview--${size}`">
    <component :is="icon" :class="['icon-preview__icon', color]" />
  </div>
</template>

<style scoped>
.icon-preview {
  position: relative;
  border-radius: var(--radius-sm);
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: hsl(var(--muted) / 0.5);
  border: 1px solid hsl(var(--border));
}

.icon-preview--md {
  width: var(--icon-preview-md-size);
  height: var(--icon-preview-md-size);
}

.icon-preview--md .icon-preview__icon {
  width: var(--icon-preview-md-icon-size);
  height: var(--icon-preview-md-icon-size);
}

.icon-preview--sm {
  width: var(--btn-sm-height);
  height: var(--btn-sm-height);
}

.icon-preview--sm .icon-preview__icon {
  width: var(--font-size-base);
  height: var(--font-size-base);
}
</style>
