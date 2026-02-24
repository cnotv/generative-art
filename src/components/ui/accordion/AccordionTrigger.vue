<script setup lang="ts">
import { AccordionHeader, AccordionTrigger } from 'radix-vue';
import { ChevronDown } from 'lucide-vue-next';
import { cn } from '@/lib/utilities';

defineProps<{
  class?: string;
}>();
</script>

<template>
  <AccordionHeader class="flex">
    <AccordionTrigger :class="cn('accordion__trigger', $props.class)">
      <slot />
      <ChevronDown class="accordion__chevron" />
    </AccordionTrigger>
  </AccordionHeader>
</template>

<style>
.accordion__trigger {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0;
  font-weight: 500;
  transition: all 150ms;
  cursor: pointer;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  color: var(--color-foreground);
}

.accordion__trigger:hover {
  text-decoration: underline;
}

.accordion__trigger[data-state="open"] .accordion__chevron {
  transform: rotate(180deg);
}

.accordion__chevron {
  height: 1rem;
  width: 1rem;
  flex-shrink: 0;
  transition: transform 200ms;
}
</style>
