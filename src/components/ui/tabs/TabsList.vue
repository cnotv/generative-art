<script setup lang="ts">
import { TabsList } from 'radix-vue';
</script>

<template>
  <TabsList class="tabs-list">
    <slot />
  </TabsList>
</template>

<style scoped>
.tabs-list {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background-color: var(--color-secondary);
  border-radius: var(--radius-md);
  flex-shrink: 0;
}
</style>
