<script setup lang="ts">
import { TabsTrigger } from 'radix-vue';

defineProps<{
  value: string;
}>();
</script>

<template>
  <TabsTrigger :value="value" class="tabs-trigger">
    <slot />
  </TabsTrigger>
</template>

<style scoped>
.tabs-trigger {
  flex: 1;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-muted-foreground);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 150ms;
}

.tabs-trigger:hover {
  color: var(--color-foreground);
}

.tabs-trigger[data-state='active'] {
  background-color: var(--color-background);
  color: var(--color-foreground);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
</style>
