<script setup lang="ts">
import { AccordionContent } from 'radix-vue';
import { cn } from '@/lib/utilities';

defineProps<{
  class?: string;
}>();
</script>

<template>
  <AccordionContent :class="cn('accordion__content', $props.class)">
    <div class="accordion__content-inner">
      <slot />
    </div>
  </AccordionContent>
</template>
