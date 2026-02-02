<script setup lang="ts">
import { AccordionContent } from 'radix-vue';

defineProps<{
  class?: string;
}>();
</script>

<template>
  <AccordionContent
    :class="[
      'overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
      $props.class,
    ]"
  >
    <div class="pb-4 pt-0">
      <slot />
    </div>
  </AccordionContent>
</template>
