<script setup lang="ts">
import { TabsContent } from 'radix-vue';

defineProps<{
  value: string;
}>();
</script>

<template>
  <TabsContent :value="value" class="tabs-content">
    <slot />
  </TabsContent>
</template>

<style scoped>
.tabs-content {
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  min-height: 0;
  margin-top: 0.75rem;
}

.tabs-content:focus {
  outline: none;
}
</style>
