<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  accept?: string
  multiple?: boolean
}>()

const emit = defineEmits<{
  change: [files: FileList]
}>()

const isDragging = ref(false)

const onDrop = (event: DragEvent): void => {
  isDragging.value = false
  if (event.dataTransfer?.files?.length) emit('change', event.dataTransfer.files)
}

const onInputChange = (event: Event): void => {
  const files = (event.target as HTMLInputElement).files
  if (files?.length) emit('change', files)
}
</script>

<template>
  <label
    class="drop-zone"
    :class="{ 'drop-zone--dragging': isDragging }"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
  >
    <svg
      class="drop-zone__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
    </svg>
    <span class="drop-zone__text">Drop images here or click to browse</span>
    <input
      type="file"
      :multiple="multiple"
      :accept="accept"
      class="drop-zone__input"
      @change="onInputChange"
    />
  </label>
</template>

<style scoped>
.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-3);
  padding: var(--spacing-10);
  border: 2px dashed var(--color-muted-foreground);
  border-radius: var(--radius-lg);
  background: var(--color-secondary);
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.drop-zone:hover,
.drop-zone--dragging {
  border-color: var(--color-primary);
  background: var(--color-muted);
}

.drop-zone__icon {
  width: 2.5rem;
  height: 2.5rem;
  color: var(--color-muted-foreground);
}

.drop-zone__text {
  color: var(--color-muted-foreground);
  font-size: var(--font-size-md);
}

.drop-zone__input {
  display: none;
}
</style>
