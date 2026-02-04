<script setup lang="ts">
import { TabsRoot } from 'radix-vue';

const props = withDefaults(
  defineProps<{
    defaultValue?: string;
    modelValue?: string;
  }>(),
  {}
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <TabsRoot
    :default-value="defaultValue"
    :model-value="modelValue"
    class="tabs"
    @update:model-value="emit('update:modelValue', $event as string)"
  >
    <slot />
  </TabsRoot>
</template>

<style scoped>
.tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
}
</style>
