<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor } from '@/components/CanvasEditor'

const SLOT_FRONT = 'mp2p-front'
const SLOT_BACK = 'mp2p-back'

const emit = defineEmits<{
  'update:front': [dataUrl: string]
  'update:back': [dataUrl: string]
}>()

type Side = 'front' | 'back'

const openSide = ref<Side | null>(null)
const frontPreview = ref('')
const backPreview = ref('')

const toggle = (side: Side): void => {
  openSide.value = openSide.value === side ? null : side
}

const handleFrontChange = (dataUrl: string): void => {
  frontPreview.value = dataUrl
  emit('update:front', dataUrl)
}

const handleBackChange = (dataUrl: string): void => {
  backPreview.value = dataUrl
  emit('update:back', dataUrl)
}
</script>

<template>
  <div class="texture-editor">
    <p class="texture-editor__label">Texture</p>

    <div class="texture-editor__previews">
      <button
        class="texture-editor__preview-btn"
        :class="{ 'texture-editor__preview-btn--active': openSide === 'front' }"
        title="Edit front texture"
        @click="toggle('front')"
      >
        <img
          v-if="frontPreview"
          :src="frontPreview"
          class="texture-editor__preview-img"
          alt="Front texture preview"
        />
        <span v-else class="texture-editor__preview-placeholder">Front</span>
      </button>

      <button
        class="texture-editor__preview-btn"
        :class="{ 'texture-editor__preview-btn--active': openSide === 'back' }"
        title="Edit back texture"
        @click="toggle('back')"
      >
        <img
          v-if="backPreview"
          :src="backPreview"
          class="texture-editor__preview-img"
          alt="Back texture preview"
        />
        <span v-else class="texture-editor__preview-placeholder">Back</span>
      </button>
    </div>

    <CanvasEditor
      v-if="openSide === 'front'"
      :slot-name="SLOT_FRONT"
      :canvas-width="256"
      :canvas-height="256"
      class="texture-editor__canvas"
      @change="handleFrontChange"
    />
    <CanvasEditor
      v-if="openSide === 'back'"
      :slot-name="SLOT_BACK"
      :canvas-width="256"
      :canvas-height="256"
      class="texture-editor__canvas"
      @change="handleBackChange"
    />
  </div>
</template>

<style scoped>
.texture-editor {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding-top: var(--spacing-3);
  border-top: 1px solid var(--color-border);
}

.texture-editor__label {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-foreground);
  margin: 0;
}

.texture-editor__previews {
  display: flex;
  gap: var(--spacing-2);
}

.texture-editor__preview-btn {
  flex: 1;
  aspect-ratio: 1;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.texture-editor__preview-btn--active {
  border-color: var(--color-primary);
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.texture-editor__preview-btn:hover {
  background: var(--color-muted);
}

.texture-editor__preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.texture-editor__preview-placeholder {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
}

.texture-editor__canvas {
  width: 100%;
}
</style>
