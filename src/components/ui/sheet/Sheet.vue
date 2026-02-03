<script setup lang="ts">
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogClose,
  DialogTitle,
  DialogDescription,
} from 'radix-vue';
import { computed } from 'vue';
import { cn } from '@/lib/utilities';
import { X } from 'lucide-vue-next';

type SheetSide = 'top' | 'bottom' | 'left' | 'right';

const props = withDefaults(
  defineProps<{
    open?: boolean;
    side?: SheetSide;
  }>(),
  {
    side: 'right',
  }
);

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const sideClasses: Record<SheetSide, string> = {
  top: 'sheet-content--top',
  bottom: 'sheet-content--bottom',
  left: 'sheet-content--left',
  right: 'sheet-content--right',
};

const contentClasses = computed(() =>
  cn('panel-ui', 'sheet-content', sideClasses[props.side])
);
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <slot name="trigger">
      <DialogTrigger as-child>
        <slot name="trigger-content" />
      </DialogTrigger>
    </slot>

    <DialogPortal>
      <DialogOverlay class="sheet-overlay" />
      <DialogContent :class="contentClasses">
        <DialogTitle class="sr-only">Sheet</DialogTitle>
        <DialogDescription class="sr-only">Sheet content</DialogDescription>
        <slot />
        <DialogClose class="sheet-close">
          <X class="h-4 w-4" />
          <span class="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
