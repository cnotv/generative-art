<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Save, FolderOpen, Trash2, ChevronDown, Download } from 'lucide-vue-next'
import { storageSave, storageLoad, storageDelete, storageList } from '@webgamekit/canvas-editor'
import type { StorageBackend } from '@webgamekit/canvas-editor'

const BACKEND_OPTIONS = [
  { value: 'localStorage', label: 'Local Storage' },
  { value: 'indexedDB', label: 'IndexedDB' }
]

const props = defineProps<{
  getSnapshot: () => string
}>()

const emit = defineEmits<{
  load: [raw: string]
}>()

const backend = ref<StorageBackend>('localStorage')
const slotName = ref('default')
const slots = ref<string[]>([])
const dropdownOpen = ref(false)
const rootReference = ref<HTMLElement | null>(null)

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

const closeDropdown = (): void => {
  dropdownOpen.value = false
}

const onClickOutside = (event: MouseEvent): void => {
  if (rootReference.value && !rootReference.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

const download = (): void => {
  const raw = props.getSnapshot()
  const data = JSON.parse(raw) as { front: string; back: string }
  const link = document.createElement('a')
  link.download = `${slotName.value || 'canvas'}-front.png`
  link.href = data.front
  link.click()
  link.download = `${slotName.value || 'canvas'}-back.png`
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
  <div ref="rootReference" class="canvas-editor-storage">
    <div class="canvas-editor-storage__row">
      <Input v-model="slotName" placeholder="Slot name" class="canvas-editor-storage__input" />

      <div class="canvas-editor-storage__save-group">
        <Button size="sm" title="Save to slot" @click="save">
          <Save class="canvas-editor-storage__icon" />
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          title="More save options"
          class="canvas-editor-storage__arrow-btn"
          @click="toggleDropdown"
        >
          <ChevronDown
            class="canvas-editor-storage__chevron"
            :class="{ 'canvas-editor-storage__chevron--open': dropdownOpen }"
          />
        </Button>
      </div>

      <div v-if="dropdownOpen" class="canvas-editor-storage__dropdown">
        <div class="canvas-editor-storage__dropdown-row">
          <Select
            :model-value="backend"
            :options="BACKEND_OPTIONS"
            placeholder="Storage backend"
            class="canvas-editor-storage__select"
            @update:model-value="onBackendChange"
          />
        </div>

        <ul v-if="slots.length > 0" class="canvas-editor-storage__list">
          <li v-for="name in slots" :key="name" class="canvas-editor-storage__slot">
            <span class="canvas-editor-storage__slot-name">{{ name }}</span>
            <Button variant="outline" size="sm" title="Load slot" @click="loadSlot(name)">
              <FolderOpen class="canvas-editor-storage__icon" />
              Load
            </Button>
            <Button variant="destructive" size="sm" title="Delete slot" @click="deleteSlot(name)">
              <Trash2 class="canvas-editor-storage__icon" />
              Delete
            </Button>
          </li>
        </ul>
        <p v-else class="canvas-editor-storage__empty">No saved slots</p>

        <Button variant="outline" size="sm" title="Download as PNG" @click="download">
          <Download class="canvas-editor-storage__icon" />
          Download PNG
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.canvas-editor-storage {
  position: relative;
}

.canvas-editor-storage__row {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
}

.canvas-editor-storage__input {
  width: 10rem;
}

.canvas-editor-storage__save-group {
  display: flex;
  align-items: stretch;
}

.canvas-editor-storage__save-group > :first-child {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: none;
}

.canvas-editor-storage__arrow-btn {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  padding: 0 var(--spacing-2);
}

.canvas-editor-storage__chevron {
  width: 1rem;
  height: 1rem;
  transition: transform 0.15s;
}

.canvas-editor-storage__chevron--open {
  transform: rotate(180deg);
}

.canvas-editor-storage__dropdown {
  position: absolute;
  top: calc(100% + var(--spacing-1));
  left: 0;
  z-index: var(--z-dropdown);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  min-width: 20rem;
}

.canvas-editor-storage__dropdown-row {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
}

.canvas-editor-storage__select {
  flex: 1;
}

.canvas-editor-storage__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1-5);
}

.canvas-editor-storage__slot {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.canvas-editor-storage__slot-name {
  flex: 1;
  font-size: var(--font-size-xs);
}

.canvas-editor-storage__icon {
  width: 1rem;
  height: 1rem;
  margin-right: var(--spacing-1);
}

.canvas-editor-storage__empty {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  margin: 0;
}
</style>
