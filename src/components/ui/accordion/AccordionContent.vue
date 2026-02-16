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

<style>
.accordion__content {
  overflow: hidden;
  font-size: 0.875rem;
}

.accordion__content[data-state="open"] {
  animation: accordionDown 200ms ease-out;
}

.accordion__content[data-state="closed"] {
  animation: accordionUp 200ms ease-out;
}

.accordion__content-inner {
  padding-bottom: 1rem;
}

@keyframes accordionDown {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}

@keyframes accordionUp {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}
</style>
