<script setup lang="ts">
import { AccordionHeader, AccordionTrigger } from 'radix-vue'
import { ChevronDown } from 'lucide-vue-next'
import { cn } from '@/lib/utilities'

defineProps<{
  class?: string
  /** `canvas` sits on the dark canvas-overlay pages, where the document colours do not apply. */
  variant?: 'default' | 'canvas'
}>()
</script>

<template>
  <AccordionHeader as="div" class="flex">
    <AccordionTrigger
      :class="
        cn('accordion__trigger', variant === 'canvas' && 'accordion__trigger--canvas', $props.class)
      "
    >
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
  font-weight: 700;
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

.accordion__trigger[data-state='open'] .accordion__chevron {
  transform: rotate(180deg);
}

.accordion__trigger--canvas {
  align-items: flex-end;
  padding: 0;
  font-weight: normal;
  color: var(--color-canvas-overlay-accent);
}

.accordion__trigger--canvas:hover {
  text-decoration: none;
}

.accordion__trigger--canvas .accordion__chevron {
  color: var(--color-canvas-overlay-muted);
}

.accordion__chevron {
  height: 1rem;
  width: 1rem;
  flex-shrink: 0;
  transition: transform 200ms;
}
</style>
