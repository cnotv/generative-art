<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ColorPicker } from '@/components/ui/color-picker'
import BrushSize from './BrushSize.vue'
import {
  Brush,
  Eraser,
  PaintBucket,
  Undo2,
  Redo2,
  Trash2,
  Save,
  FolderOpen,
  ChevronDown,
  Download
} from 'lucide-vue-next'
import { storageSave, storageLoad, storageDelete, storageList } from '@webgamekit/canvas-editor'
import type { DrawingTool, StorageBackend } from '@webgamekit/canvas-editor'

const BACKEND_OPTIONS = [
  { value: 'localStorage', label: 'Local Storage' },
  { value: 'indexedDB', label: 'IndexedDB' }
]

const props = defineProps<{
  tool: DrawingTool
  color: string
  size: number
  canUndo: boolean
  canRedo: boolean
  getSnapshot: () => string
}>()

const emit = defineEmits<{
  'update:tool': [value: DrawingTool]
  'update:color': [value: string]
  'update:size': [value: number]
  undo: []
  redo: []
  clear: []
  load: [raw: string]
}>()

const backend = ref<StorageBackend>('localStorage')
const slotName = ref('default')
const slots = ref<string[]>([])
const dropdownOpen = ref(false)
const saveGroupReference = ref<HTMLElement | null>(null)

const refreshSlots = async (): Promise<void> => {
  slots.value = await Promise.resolve(storageList(backend.value))
}

const save = async (): Promise<void> => {
  const name = slotName.value.trim() || 'default'
  await storageSave(backend.value, name, props.getSnapshot())
  await refreshSlots()
}

const loadSlot = async (name: string): Promise<void> => {
  const slot = await storageLoad(backend.value, name)
  if (!slot) return
  emit('load', slot.dataUrl)
}

const deleteSlot = async (name: string): Promise<void> => {
  await storageDelete(backend.value, name)
  await refreshSlots()
}

const onBackendChange = async (value: string): Promise<void> => {
  backend.value = value as StorageBackend
  await refreshSlots()
}

const toggleDropdown = (): void => {
  dropdownOpen.value = !dropdownOpen.value
}

const onClickOutside = (event: MouseEvent): void => {
  if (saveGroupReference.value && !saveGroupReference.value.contains(event.target as Node)) {
    dropdownOpen.value = false
  }
}

const download = (): void => {
  const raw = props.getSnapshot()
  const data = JSON.parse(raw) as { front: string; back: string }
  const link = document.createElement('a')
  const name = slotName.value.trim() || 'canvas'
  link.download = `${name}-front.png`
  link.href = data.front
  link.click()
  link.download = `${name}-back.png`
  link.href = data.back
  link.click()
}

onMounted(() => {
  refreshSlots()
  document.addEventListener('mousedown', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
})
</script>

<template>
  <div class="canvas-editor-tools">
    <div class="canvas-editor-tools__group">
      <Button
        :variant="tool === 'brush' ? 'default' : 'outline'"
        size="icon"
        title="Brush"
        @click="emit('update:tool', 'brush')"
      >
        <Brush class="canvas-editor-tools__icon" />
      </Button>
      <Button
        :variant="tool === 'eraser' ? 'default' : 'outline'"
        size="icon"
        title="Eraser"
        @click="emit('update:tool', 'eraser')"
      >
        <Eraser class="canvas-editor-tools__icon" />
      </Button>
      <Button
        :variant="tool === 'fill' ? 'default' : 'outline'"
        size="icon"
        title="Fill"
        @click="emit('update:tool', 'fill')"
      >
        <PaintBucket class="canvas-editor-tools__icon" />
      </Button>
    </div>

    <div class="canvas-editor-tools__group">
      <label class="canvas-editor-tools__label">
        Color
        <ColorPicker :model-value="color" @update:model-value="emit('update:color', $event)" />
      </label>
      <BrushSize
        :model-value="size"
        :min="1"
        :max="80"
        @update:model-value="emit('update:size', $event)"
      />
    </div>

    <div class="canvas-editor-tools__group">
      <Button
        variant="outline"
        size="icon"
        :disabled="!canUndo"
        title="Undo (Ctrl+Z)"
        @click="emit('undo')"
      >
        <Undo2 class="canvas-editor-tools__icon" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        :disabled="!canRedo"
        title="Redo (Ctrl+Y)"
        @click="emit('redo')"
      >
        <Redo2 class="canvas-editor-tools__icon" />
      </Button>
      <Button variant="destructive" size="icon" title="Clear canvas" @click="emit('clear')">
        <Trash2 class="canvas-editor-tools__icon" />
      </Button>

      <div ref="saveGroupReference" class="canvas-editor-tools__save-group">
        <Button size="sm" title="Save to slot" @click="save">
          <Save class="canvas-editor-tools__icon canvas-editor-tools__icon--mr" />
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          title="More save options"
          class="canvas-editor-tools__arrow-btn"
          @click="toggleDropdown"
        >
          <ChevronDown
            class="canvas-editor-tools__icon"
            :class="{ 'canvas-editor-tools__chevron--open': dropdownOpen }"
          />
        </Button>

        <div v-if="dropdownOpen" class="canvas-editor-tools__dropdown">
          <div class="canvas-editor-tools__dropdown-row">
            <Input
              v-model="slotName"
              placeholder="Slot name"
              class="canvas-editor-tools__slot-input"
            />
            <Select
              :model-value="backend"
              :options="BACKEND_OPTIONS"
              placeholder="Backend"
              @update:model-value="onBackendChange"
            />
          </div>

          <ul v-if="slots.length > 0" class="canvas-editor-tools__slot-list">
            <li v-for="name in slots" :key="name" class="canvas-editor-tools__slot">
              <span class="canvas-editor-tools__slot-name">{{ name }}</span>
              <Button variant="outline" size="sm" title="Load slot" @click="loadSlot(name)">
                <FolderOpen class="canvas-editor-tools__icon canvas-editor-tools__icon--mr" />
                Load
              </Button>
              <Button variant="destructive" size="sm" title="Delete slot" @click="deleteSlot(name)">
                <Trash2 class="canvas-editor-tools__icon canvas-editor-tools__icon--mr" />
                Delete
              </Button>
            </li>
          </ul>
          <p v-else class="canvas-editor-tools__empty">No saved slots</p>

          <Button variant="outline" size="sm" title="Download as PNG" @click="download">
            <Download class="canvas-editor-tools__icon canvas-editor-tools__icon--mr" />
            Download PNG
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.canvas-editor-tools {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-4);
  align-items: center;
  padding: var(--spacing-3) var(--spacing-4);
  background: var(--color-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.canvas-editor-tools__group {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
}

.canvas-editor-tools__label {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  cursor: pointer;
}

.canvas-editor-tools__label--size {
  gap: var(--spacing-3);
}

.canvas-editor-tools__icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.canvas-editor-tools__icon--mr {
  margin-right: var(--spacing-1);
}

.canvas-editor-tools__size-value {
  display: inline-block;
  min-width: 2ch;
  text-align: right;
}

.canvas-editor-tools__slider {
  min-width: 6rem;
  width: 6rem;
}

.canvas-editor-tools__save-group {
  position: relative;
  display: flex;
  align-items: stretch;
}

.canvas-editor-tools__save-group > :first-child {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.canvas-editor-tools__arrow-btn {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: none;
  padding: 0 var(--spacing-2);
}

.canvas-editor-tools__chevron--open {
  transform: rotate(180deg);
}

.canvas-editor-tools__dropdown {
  position: absolute;
  top: calc(100% + var(--spacing-2));
  right: 0;
  z-index: var(--z-dropdown);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  min-width: 22rem;
}

.canvas-editor-tools__dropdown-row {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
}

.canvas-editor-tools__slot-input {
  flex: 1;
}

.canvas-editor-tools__slot-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1-5);
}

.canvas-editor-tools__slot {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.canvas-editor-tools__slot-name {
  flex: 1;
  font-size: var(--font-size-xs);
}

.canvas-editor-tools__empty {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  margin: 0;
}
</style>
