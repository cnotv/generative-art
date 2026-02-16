<script setup lang="ts">
import { AccordionRoot } from 'radix-vue';

defineProps<{
  type?: 'single' | 'multiple';
  collapsible?: boolean;
  defaultValue?: string | string[];
}>();
</script>

<template>
  <AccordionRoot
    :type="type ?? 'single'"
    :collapsible="collapsible ?? true"
    :default-value="defaultValue"
    class="accordion"
  >
    <slot />
  </AccordionRoot>
</template>

<style>
.accordion {
  width: 100%;
}
</style>
