<script setup lang="ts">
import { AccordionItem } from 'radix-vue';

defineProps<{
  value: string;
}>();
</script>

<template>
  <AccordionItem :value="value" class="border-b">
    <slot />
  </AccordionItem>
</template>
