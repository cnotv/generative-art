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
} from "radix-vue";
import { computed, ref, watch } from "vue";
import { cn } from "@/lib/utilities";

type SheetSide = "top" | "bottom" | "left" | "right";

const props = withDefaults(
  defineProps<{
    open?: boolean;
    side?: SheetSide;
  }>(),
  {
    side: "right",
  }
);

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const sideClasses: Record<SheetSide, string> = {
  top: "sheet-content--top",
  bottom: "sheet-content--bottom",
  left: "sheet-content--left",
  right: "sheet-content--right",
};

const contentClasses = computed(() =>
  cn("panel-ui", "sheet-content", sideClasses[props.side])
);

// Track when dialog opened to ignore clicks that happen immediately after
const openedAt = ref(0);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      openedAt.value = Date.now();
    }
  }
);

const handlePointerDownOutside = (event: Event) => {
  // Ignore clicks within 100ms of opening (same click that opened it)
  const timeSinceOpen = Date.now() - openedAt.value;
  if (timeSinceOpen < 100) {
    event.preventDefault();
    return;
  }
  emit("update:open", false);
};

const handleOverlayClick = () => {
  // Ignore clicks within 100ms of opening (same click that opened it)
  const timeSinceOpen = Date.now() - openedAt.value;
  if (timeSinceOpen < 100) {
    return;
  }
  emit("update:open", false);
};
</script>

<template>
  <DialogRoot :open="open" :modal="true" @update:open="emit('update:open', $event)">
    <slot name="trigger">
      <DialogTrigger as-child>
        <slot name="trigger-content" />
      </DialogTrigger>
    </slot>

    <DialogPortal>
      <DialogOverlay class="sheet-overlay" @click="handleOverlayClick" />
      <DialogContent
        :class="contentClasses"
        @pointer-down-outside="handlePointerDownOutside"
      >
        <DialogTitle class="sr-only">Sheet</DialogTitle>
        <DialogDescription class="sr-only">Sheet content</DialogDescription>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
