<script setup lang="ts">
import { ref, computed } from 'vue'
import { PIECE_CATALOG, PLACEABLE_PIECE_TYPES } from './pieceCatalog'
import { SAMPLE_MAPS } from './sampleMaps'
import type { MarbleMap, PlacedPiece, TrackPieceType } from './types'

const props = defineProps<{
  selectedPiece: PlacedPiece | null
  savedMaps: MarbleMap[]
  mapName: string
}>()

const emit = defineEmits<{
  add: [type: TrackPieceType]
  preview: [type: TrackPieceType | null]
  recolor: [color: number]
  deletePiece: []
  saveAs: [name: string]
  loadMap: [map: MarbleMap]
  deleteMap: [name: string]
  newMap: []
  play: []
}>()

const saveName = ref('')

const selectedColorHex = computed(() =>
  props.selectedPiece ? `#${props.selectedPiece.color.toString(16).padStart(6, '0')}` : '#ffffff'
)

const handleColorInput = (event: Event): void => {
  const value = (event.target as HTMLInputElement).value
  emit('recolor', parseInt(value.replace('#', ''), 16))
}

const handleSave = (): void => {
  const name = saveName.value.trim() || props.mapName
  if (!name) return
  emit('saveAs', name)
  saveName.value = ''
}
</script>

<template>
  <aside class="editor-palette">
    <header class="editor-palette__header">
      <h2 class="editor-palette__title">{{ mapName }}</h2>
      <button
        class="editor-palette__button editor-palette__button--cta"
        title="Race the current track"
        @click="emit('play')"
      >
        Play
      </button>
    </header>

    <section class="editor-palette__section">
      <h3 class="editor-palette__section-title">Pieces</h3>
      <p class="editor-palette__hint">
        {{
          selectedPiece
            ? `Inserting after the selected ${PIECE_CATALOG[selectedPiece.type].label}`
            : 'Adding at the end of the track'
        }}
      </p>
      <div class="editor-palette__grid">
        <button
          v-for="type in PLACEABLE_PIECE_TYPES"
          :key="type"
          class="editor-palette__button"
          :title="`Add a ${PIECE_CATALOG[type].label} piece`"
          @click="emit('add', type)"
          @mouseenter="emit('preview', type)"
          @mouseleave="emit('preview', null)"
        >
          {{ PIECE_CATALOG[type].label }}
        </button>
      </div>
    </section>

    <section v-if="selectedPiece" class="editor-palette__section">
      <h3 class="editor-palette__section-title">
        Selected: {{ PIECE_CATALOG[selectedPiece.type].label }}
      </h3>
      <div class="editor-palette__row">
        <label class="editor-palette__label" for="piece-color">Color</label>
        <input
          id="piece-color"
          class="editor-palette__color"
          type="color"
          :value="selectedColorHex"
          title="Change the color of the selected piece"
          @input="handleColorInput"
        />
        <button
          class="editor-palette__button editor-palette__button--danger"
          title="Remove the selected piece from the track"
          @click="emit('deletePiece')"
        >
          Remove
        </button>
      </div>
    </section>

    <section class="editor-palette__section">
      <h3 class="editor-palette__section-title">Maps</h3>
      <div class="editor-palette__row">
        <input
          v-model="saveName"
          class="editor-palette__input"
          type="text"
          placeholder="Map name"
          title="Name for the saved map"
          @keyup.enter="handleSave"
        />
        <button class="editor-palette__button" title="Save the current map" @click="handleSave">
          Save
        </button>
      </div>
      <button
        class="editor-palette__button"
        title="Start a new empty track"
        @click="emit('newMap')"
      >
        New track
      </button>
      <ul v-if="savedMaps.length" class="editor-palette__list">
        <li v-for="map in savedMaps" :key="map.name" class="editor-palette__list-item">
          <button
            class="editor-palette__button editor-palette__button--link"
            :title="`Load the saved map ${map.name}`"
            @click="emit('loadMap', map)"
          >
            {{ map.name }}
          </button>
          <button
            class="editor-palette__button editor-palette__button--danger"
            :title="`Delete the saved map ${map.name}`"
            @click="emit('deleteMap', map.name)"
          >
            Delete
          </button>
        </li>
      </ul>
      <h4 class="editor-palette__section-subtitle">Samples</h4>
      <ul class="editor-palette__list">
        <li v-for="map in SAMPLE_MAPS" :key="map.name" class="editor-palette__list-item">
          <button
            class="editor-palette__button editor-palette__button--link"
            :title="`Load the sample map ${map.name}`"
            @click="emit('loadMap', map)"
          >
            {{ map.name }}
          </button>
        </li>
      </ul>
    </section>
  </aside>
</template>

<style scoped>
.editor-palette {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  width: 16rem;
  max-height: 100%;
  padding: var(--spacing-4);
  overflow-y: auto;
  color: var(--color-foreground);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.editor-palette__header {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
  justify-content: space-between;
}

.editor-palette__title {
  margin: 0;
  overflow: hidden;
  font-size: var(--font-size-lg);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-palette__section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.editor-palette__section-title {
  margin: 0;
  font-size: var(--font-size-md);
}

.editor-palette__section-subtitle {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.editor-palette__hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
}

.editor-palette__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-1);
}

.editor-palette__row {
  display: flex;
  gap: var(--spacing-1);
  align-items: center;
}

.editor-palette__button {
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  cursor: pointer;
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.editor-palette__button:hover {
  background: var(--color-accent);
}

.editor-palette__button--cta {
  color: var(--color-primary-foreground);
  background: var(--color-primary);
}

.editor-palette__button--danger {
  color: var(--color-destructive-foreground);
  background: var(--color-destructive);
}

.editor-palette__button--link {
  flex: 1;
  text-align: left;
  background: transparent;
  border: none;
}

.editor-palette__input {
  flex: 1;
  min-width: 0;
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.editor-palette__color {
  width: 2.5rem;
  height: 2rem;
  padding: 0;
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.editor-palette__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  padding: 0;
  margin: 0;
  list-style: none;
}

.editor-palette__list-item {
  display: flex;
  gap: var(--spacing-1);
  align-items: center;
}
</style>
