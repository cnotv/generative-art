<script setup lang="ts">
import { AccordionItem } from 'radix-vue';

defineProps<{
  value: string;
}>();
</script>

<template>
  <AccordionItem :value="value" class="accordion__item">
    <slot />
  </AccordionItem>
</template>
