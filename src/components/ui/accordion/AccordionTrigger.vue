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
