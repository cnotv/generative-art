<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { CanvasEditor } from '@/components/CanvasEditor'
import { Upload, ArrowLeftRight, RotateCcw } from 'lucide-vue-next'

const SLOT_FRONT = 'mp2p-front'
const SLOT_BACK = 'mp2p-back'

const props = defineProps<{
  frontDefault?: string
  backDefault?: string
  backgroundImage?: string
}>()

const emit = defineEmits<{
  'update:front': [dataUrl: string]
  'update:back': [dataUrl: string]
}>()

type Side = 'front' | 'back'

const openSide = ref<Side | null>(null)
const frontPreview = ref(props.frontDefault ?? '')
const backPreview = ref(props.backDefault ?? '')
const frontEditorReference = ref<InstanceType<typeof CanvasEditor> | null>(null)
const backEditorReference = ref<InstanceType<typeof CanvasEditor> | null>(null)
const frontFileReference = ref<HTMLInputElement | null>(null)
const backFileReference = ref<HTMLInputElement | null>(null)

onMounted(() => {
  if (props.frontDefault) emit('update:front', props.frontDefault)
  if (props.backDefault) emit('update:back', props.backDefault)
})

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

const loadFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(event.target?.result as string)
    reader.readAsDataURL(file)
  })

const handleFrontUpload = async (event: Event): Promise<void> => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const dataUrl = await loadFileAsDataUrl(file)
  frontPreview.value = dataUrl
  emit('update:front', dataUrl)
  await frontEditorReference.value?.restore(dataUrl)
  if (frontFileReference.value) frontFileReference.value.value = ''
}

const handleBackUpload = async (event: Event): Promise<void> => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const dataUrl = await loadFileAsDataUrl(file)
  backPreview.value = dataUrl
  emit('update:back', dataUrl)
  await backEditorReference.value?.restore(dataUrl)
  if (backFileReference.value) backFileReference.value.value = ''
}

const resetFront = (): void => {
  frontPreview.value = ''
  frontEditorReference.value?.clear()
  emit('update:front', '')
}

const resetBack = (): void => {
  backPreview.value = ''
  backEditorReference.value?.clear()
  emit('update:back', '')
}

const copyFrontToBack = async (): Promise<void> => {
  const dataUrl = frontPreview.value
  if (!dataUrl) return
  backPreview.value = dataUrl
  emit('update:back', dataUrl)
  await backEditorReference.value?.restore(dataUrl)
}

const copyBackToFront = async (): Promise<void> => {
  const dataUrl = backPreview.value
  if (!dataUrl) return
  frontPreview.value = dataUrl
  emit('update:front', dataUrl)
  await frontEditorReference.value?.restore(dataUrl)
}
</script>

<template>
  <div class="texture-editor">
    <p class="texture-editor__label">Texture</p>

    <div class="texture-editor__previews">
      <div class="texture-editor__side">
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
        <div class="texture-editor__action-row">
          <button
            class="texture-editor__upload-btn"
            title="Upload front texture"
            @click="frontFileReference?.click()"
          >
            <Upload class="texture-editor__upload-icon" />
          </button>
          <button
            class="texture-editor__reset-btn"
            title="Reset front texture"
            :disabled="!frontPreview"
            @click="resetFront"
          >
            <RotateCcw class="texture-editor__reset-icon" />
          </button>
        </div>
        <input
          ref="frontFileReference"
          type="file"
          accept="image/*"
          class="texture-editor__file-input"
          @change="handleFrontUpload"
        />
      </div>

      <div class="texture-editor__copy-btns">
        <button
          class="texture-editor__copy-btn"
          title="Copy front to back"
          :disabled="!frontPreview"
          @click="copyFrontToBack"
        >
          <ArrowLeftRight class="texture-editor__copy-icon" />
        </button>
        <button
          class="texture-editor__copy-btn"
          title="Copy back to front"
          :disabled="!backPreview"
          @click="copyBackToFront"
        >
          <ArrowLeftRight class="texture-editor__copy-icon texture-editor__copy-icon--flip" />
        </button>
      </div>

      <div class="texture-editor__side">
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
        <div class="texture-editor__action-row">
          <button
            class="texture-editor__upload-btn"
            title="Upload back texture"
            @click="backFileReference?.click()"
          >
            <Upload class="texture-editor__upload-icon" />
          </button>
          <button
            class="texture-editor__reset-btn"
            title="Reset back texture"
            :disabled="!backPreview"
            @click="resetBack"
          >
            <RotateCcw class="texture-editor__reset-icon" />
          </button>
        </div>
        <input
          ref="backFileReference"
          type="file"
          accept="image/*"
          class="texture-editor__file-input"
          @change="handleBackUpload"
        />
      </div>
    </div>

    <CanvasEditor
      v-if="openSide === 'front'"
      ref="frontEditorReference"
      :slot-name="SLOT_FRONT"
      :canvas-width="256"
      :canvas-height="256"
      :default-image="frontDefault"
      :background-image="backgroundImage ?? frontDefault"
      class="texture-editor__canvas"
      @change="handleFrontChange"
    />
    <CanvasEditor
      v-if="openSide === 'back'"
      ref="backEditorReference"
      :slot-name="SLOT_BACK"
      :canvas-width="256"
      :canvas-height="256"
      :default-image="backDefault"
      :background-image="backgroundImage ?? backDefault"
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

.texture-editor__side {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.texture-editor__preview-btn {
  width: 100%;
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
  object-fit: contain;
  display: block;
}

.texture-editor__preview-placeholder {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
}

.texture-editor__action-row {
  display: flex;
  gap: var(--spacing-1);
}

.texture-editor__upload-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  cursor: pointer;
}

.texture-editor__upload-btn:hover {
  background: var(--color-muted);
  color: var(--color-foreground);
}

.texture-editor__upload-icon {
  width: 0.75rem;
  height: 0.75rem;
  flex-shrink: 0;
}

.texture-editor__reset-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  color: var(--color-muted-foreground);
  cursor: pointer;
}

.texture-editor__reset-btn:hover:not(:disabled) {
  background: var(--color-muted);
  color: var(--color-foreground);
}

.texture-editor__reset-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.texture-editor__reset-icon {
  width: 0.75rem;
  height: 0.75rem;
}

.texture-editor__file-input {
  display: none;
}

.texture-editor__copy-btns {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-1);
}

.texture-editor__copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  color: var(--color-muted-foreground);
  cursor: pointer;
  padding: 0;
}

.texture-editor__copy-btn:hover:not(:disabled) {
  background: var(--color-muted);
  color: var(--color-foreground);
}

.texture-editor__copy-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.texture-editor__copy-icon {
  width: 0.75rem;
  height: 0.75rem;
}

.texture-editor__copy-icon--flip {
  transform: scaleY(-1);
}

.texture-editor__canvas {
  width: 100%;
}
</style>
