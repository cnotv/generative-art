<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import ConverterWorker from './imageConverter.worker?worker'
import {
  FORMAT_OPTIONS,
  DEFAULT_FORMAT,
  DEFAULT_QUALITY,
  DEFAULT_MAX_DIMENSION,
  ACCEPTED_TYPES,
  type ImageFormat,
  type ConvertRequest,
  type ConvertResult,
  type ConvertError
} from './config'

type FileEntry = {
  id: string
  name: string
  originalSize: number
  mimeType: string
  buffer: ArrayBuffer
  previewUrl: string
  status: 'pending' | 'processing' | 'done' | 'error'
  convertedBlob?: Blob
  convertedSize?: number
  downloadUrl?: string
  error?: string
}

const format = ref<ImageFormat>(DEFAULT_FORMAT)
const quality = ref(DEFAULT_QUALITY)
const maxWidth = ref(DEFAULT_MAX_DIMENSION)
const maxHeight = ref(DEFAULT_MAX_DIMENSION)
const isDragging = ref(false)
const files = ref<FileEntry[]>([])

const selectedFormatOption = computed(() => FORMAT_OPTIONS.find((f) => f.value === format.value)!)
const isLossy = computed(() => selectedFormatOption.value.lossy)

const worker = new ConverterWorker()

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const savings = (entry: FileEntry): string => {
  if (!entry.convertedSize) return ''
  const pct = ((1 - entry.convertedSize / entry.originalSize) * 100).toFixed(1)
  return Number(pct) > 0 ? `-${pct}%` : `+${Math.abs(Number(pct))}%`
}

const resultExtension = computed(() => selectedFormatOption.value.extension)

const downloadName = (entry: FileEntry): string => {
  const base = entry.name.replace(/\.[^.]+$/, '')
  return `${base}.${resultExtension.value}`
}

worker.onmessage = (event: MessageEvent<ConvertResult | ConvertError>) => {
  const data = event.data
  const entry = files.value.find((f) => f.id === data.id)
  if (!entry) return

  if ('error' in data) {
    entry.status = 'error'
    entry.error = data.error
    return
  }

  const result = data as ConvertResult
  const blob = new Blob([result.buffer], { type: result.format })
  entry.convertedBlob = blob
  entry.convertedSize = result.convertedSize
  entry.downloadUrl = URL.createObjectURL(blob)
  entry.status = 'done'
}

const processEntry = (entry: FileEntry): void => {
  entry.status = 'processing'
  const request: ConvertRequest = {
    id: entry.id,
    buffer: entry.buffer,
    mimeType: entry.mimeType,
    format: format.value,
    quality: quality.value,
    maxWidth: maxWidth.value,
    maxHeight: maxHeight.value
  }
  worker.postMessage(request)
}

const readFile = (file: File): Promise<FileEntry> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer
      const previewUrl = URL.createObjectURL(file)
      resolve({
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        originalSize: file.size,
        mimeType: file.type,
        buffer,
        previewUrl,
        status: 'pending'
      })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })

const addFiles = async (fileList: FileList | null): Promise<void> => {
  if (!fileList) return
  const entries = await Promise.all([...fileList].map(readFile))
  files.value = [...files.value, ...entries]
  entries.forEach(processEntry)
}

const onDrop = (event: DragEvent): void => {
  isDragging.value = false
  addFiles(event.dataTransfer?.files ?? null)
}

const onInputChange = (event: Event): void => {
  addFiles((event.target as HTMLInputElement).files)
}

const reconvertAll = (): void => {
  files.value.forEach((entry) => {
    if (entry.downloadUrl) URL.revokeObjectURL(entry.downloadUrl)
    entry.downloadUrl = undefined
    entry.convertedBlob = undefined
    entry.convertedSize = undefined
    entry.error = undefined
    processEntry(entry)
  })
}

const removeEntry = (id: string): void => {
  const entry = files.value.find((f) => f.id === id)
  if (entry) {
    URL.revokeObjectURL(entry.previewUrl)
    if (entry.downloadUrl) URL.revokeObjectURL(entry.downloadUrl)
  }
  files.value = files.value.filter((f) => f.id !== id)
}

const clearAll = (): void => {
  files.value.forEach((entry) => {
    URL.revokeObjectURL(entry.previewUrl)
    if (entry.downloadUrl) URL.revokeObjectURL(entry.downloadUrl)
  })
  files.value = []
}

onUnmounted(() => {
  worker.terminate()
  clearAll()
})
</script>

<template>
  <div class="image-converter">
    <div class="image-converter__controls">
      <div class="image-converter__control-group">
        <label class="image-converter__label">Format</label>
        <div class="image-converter__format-options">
          <label
            v-for="opt in FORMAT_OPTIONS"
            :key="opt.value"
            class="image-converter__format-option"
            :class="{ 'image-converter__format-option--active': format === opt.value }"
          >
            <input
              v-model="format"
              type="radio"
              :value="opt.value"
              class="image-converter__radio"
            />
            {{ opt.label }}
          </label>
        </div>
      </div>

      <div v-if="isLossy" class="image-converter__control-group">
        <label class="image-converter__label">Quality — {{ quality }}%</label>
        <input
          v-model.number="quality"
          type="range"
          min="1"
          max="100"
          class="image-converter__range"
        />
      </div>

      <div class="image-converter__control-group image-converter__control-group--row">
        <div class="image-converter__control-group">
          <label class="image-converter__label">Max width (px)</label>
          <input
            v-model.number="maxWidth"
            type="number"
            min="0"
            placeholder="0 = no limit"
            class="image-converter__input"
          />
        </div>
        <div class="image-converter__control-group">
          <label class="image-converter__label">Max height (px)</label>
          <input
            v-model.number="maxHeight"
            type="number"
            min="0"
            placeholder="0 = no limit"
            class="image-converter__input"
          />
        </div>
      </div>

      <div v-if="files.length > 0" class="image-converter__actions">
        <button class="image-converter__btn" type="button" @click="reconvertAll">
          Re-convert all
        </button>
        <button
          class="image-converter__btn image-converter__btn--ghost"
          type="button"
          @click="clearAll"
        >
          Clear all
        </button>
      </div>
    </div>

    <div
      class="image-converter__dropzone"
      :class="{ 'image-converter__dropzone--dragging': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
    >
      <svg
        class="image-converter__dropzone-icon"
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
      <span class="image-converter__dropzone-text">Drop images here or</span>
      <label class="image-converter__btn image-converter__btn--primary">
        Browse
        <input
          type="file"
          multiple
          :accept="ACCEPTED_TYPES"
          class="image-converter__file-input"
          @change="onInputChange"
        />
      </label>
    </div>

    <ul v-if="files.length > 0" class="image-converter__file-list">
      <li v-for="entry in files" :key="entry.id" class="image-converter__file-item">
        <img :src="entry.previewUrl" :alt="entry.name" class="image-converter__thumb" />

        <div class="image-converter__file-info">
          <span class="image-converter__file-name" :title="entry.name">{{ entry.name }}</span>
          <div class="image-converter__file-sizes">
            <span>{{ formatBytes(entry.originalSize) }}</span>
            <template v-if="entry.status === 'done' && entry.convertedSize !== undefined">
              <span class="image-converter__arrow">→</span>
              <span>{{ formatBytes(entry.convertedSize) }}</span>
              <span
                class="image-converter__savings"
                :class="
                  entry.convertedSize < entry.originalSize
                    ? 'image-converter__savings--positive'
                    : 'image-converter__savings--negative'
                "
              >
                {{ savings(entry) }}
              </span>
            </template>
          </div>
          <span v-if="entry.status === 'processing'" class="image-converter__status">
            Converting…
          </span>
          <span
            v-if="entry.status === 'error'"
            class="image-converter__status image-converter__status--error"
          >
            {{ entry.error }}
          </span>
        </div>

        <div class="image-converter__file-actions">
          <a
            v-if="entry.downloadUrl"
            :href="entry.downloadUrl"
            :download="downloadName(entry)"
            class="image-converter__btn image-converter__btn--primary"
          >
            Download
          </a>
          <button
            class="image-converter__btn image-converter__btn--ghost"
            type="button"
            @click="removeEntry(entry.id)"
          >
            ✕
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.image-converter {
  padding-top: var(--nav-height);
  min-height: 100vh;
  max-width: 56rem;
  margin: 0 auto;
  padding-inline: var(--spacing-4);
  padding-bottom: var(--spacing-10);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.image-converter__controls {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
  background: var(--color-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.image-converter__control-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.image-converter__control-group--row {
  flex-direction: row;
  gap: var(--spacing-4);
}

.image-converter__control-group--row > * {
  flex: 1;
}

.image-converter__label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.image-converter__format-options {
  display: flex;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.image-converter__format-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1-5) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-md);
  background: var(--color-background);
  transition: border-color 0.15s;
}

.image-converter__format-option--active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.image-converter__radio {
  display: none;
}

.image-converter__range {
  width: 100%;
  accent-color: var(--color-primary);
}

.image-converter__input {
  width: 100%;
  padding: var(--spacing-1-5) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-md);
  box-sizing: border-box;
}

.image-converter__actions {
  display: flex;
  gap: var(--spacing-2);
}

.image-converter__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1-5) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  cursor: pointer;
  background: var(--color-background);
  color: var(--color-foreground);
  text-decoration: none;
  white-space: nowrap;
}

.image-converter__btn--primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  border-color: var(--color-primary);
}

.image-converter__btn--ghost {
  background: transparent;
  border-color: transparent;
}

.image-converter__file-input {
  display: none;
}

.image-converter__dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-3);
  padding: var(--spacing-10);
  border: 2px dashed var(--color-muted-foreground);
  border-radius: var(--radius-lg);
  background: var(--color-secondary);
  transition:
    border-color 0.15s,
    background 0.15s;
  cursor: default;
}

.image-converter__dropzone--dragging {
  border-color: var(--color-primary);
  background: var(--color-muted);
}

.image-converter__dropzone-icon {
  width: 2.5rem;
  height: 2.5rem;
  color: var(--color-muted-foreground);
}

.image-converter__dropzone-text {
  color: var(--color-muted-foreground);
  font-size: var(--font-size-md);
}

.image-converter__file-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.image-converter__file-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-secondary);
}

.image-converter__thumb {
  width: 3.5rem;
  height: 3.5rem;
  object-fit: cover;
  border-radius: var(--radius-md);
  flex-shrink: 0;
  border: 1px solid var(--color-border);
}

.image-converter__file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.image-converter__file-name {
  font-size: var(--font-size-md);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-converter__file-sizes {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.image-converter__arrow {
  opacity: 0.5;
}

.image-converter__savings {
  font-weight: 700;
}

.image-converter__savings--positive {
  color: #16a34a;
}

.image-converter__savings--negative {
  color: #dc2626;
}

.image-converter__status {
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.image-converter__status--error {
  color: #dc2626;
}

.image-converter__file-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  flex-shrink: 0;
}

@media (width <= 480px) {
  .image-converter__control-group--row {
    flex-direction: column;
  }

  .image-converter__file-item {
    flex-wrap: wrap;
  }
}
</style>
