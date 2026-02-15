<script setup lang="ts">
import type { Component } from 'vue';

interface Props {
  icon: Component;
  color?: string;
}

const props = withDefaults(defineProps<Props>(), {
  color: 'text-gray-400',
});
</script>

<template>
  <div class="icon-preview">
    <component
      :is="icon"
      :class="['icon-preview__icon', color]"
    />
  </div>
</template>

<style scoped>
.icon-preview {
  position: relative;
  min-width: 48px;
  min-height: 48px;
  max-width: 64px;
  max-height: 64px;
  width: 48px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--muted) / 0.3);
}

.icon-preview__icon {
  width: 24px;
  height: 24px;
}
</style>
