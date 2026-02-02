<script setup lang="ts">
import {
  AccordionRoot,
  AccordionItem,
  AccordionHeader,
  AccordionTrigger,
  AccordionContent,
} from 'radix-vue';
import { cn } from '@/lib/utilities';
import { ChevronDown } from 'lucide-vue-next';

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
    class="w-full"
  >
    <slot />
  </AccordionRoot>
</template>
