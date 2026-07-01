<script setup lang="ts">
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose
} from 'radix-vue'
import { X } from 'lucide-vue-next'

defineProps<{
  open?: boolean
  title?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="dialog__overlay" />
      <DialogContent class="dialog__content">
        <div class="dialog__header">
          <DialogTitle class="dialog__title">{{ title }}</DialogTitle>
          <DialogClose class="dialog__close" aria-label="Close">
            <X class="dialog__close-icon" />
          </DialogClose>
        </div>
        <div class="dialog__body">
          <slot />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background-color: rgb(0, 0, 0, 0.5);
}

.dialog__content {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: var(--z-modal);
  width: min(90vw, 32rem);
  max-height: 85vh;
  overflow-y: auto;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-foreground);
  box-shadow: var(--shadow-xl);
}

.dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-2);
}

.dialog__title {
  margin: 0;
  font-size: var(--font-size-lg);
}

.dialog__close {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-1);
  border: none;
  background: transparent;
  color: var(--color-muted-foreground);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.dialog__close:hover {
  color: var(--color-foreground);
}

.dialog__close-icon {
  width: 1rem;
  height: 1rem;
}

.dialog__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}
</style>
