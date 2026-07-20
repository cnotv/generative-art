<script setup lang="ts">
import { computed } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import { LobbyUIButton, LobbyUIIconButton } from '@/components/LobbyUI'
import { PIECE_CATALOG, PLACEABLE_PIECE_TYPES } from '../pieceCatalog'
import PiecePreviewIcon from '../PiecePreviewIcon.vue'
import type { PlacedPiece, TrackPieceType } from '../types'

const props = defineProps<{
  selectedPiece: PlacedPiece | null
}>()

const emit = defineEmits<{
  add: [type: TrackPieceType]
  preview: [type: TrackPieceType | null]
  recolor: [color: number]
  deletePiece: []
}>()

const selectedColorHex = computed(() =>
  props.selectedPiece ? `#${props.selectedPiece.color.toString(16).padStart(6, '0')}` : '#ffffff'
)

const handleColorInput = (event: Event): void => {
  const value = (event.target as HTMLInputElement).value
  emit('recolor', parseInt(value.replace('#', ''), 16))
}
</script>

<template>
  <aside class="editor-palette">
    <section class="editor-palette__section">
      <h3 class="editor-palette__section-title">Pieces</h3>
      <div class="editor-palette__grid" data-lui-row>
        <LobbyUIButton
          v-for="type in PLACEABLE_PIECE_TYPES"
          :key="type"
          stacked
          variant="ghost"
          :title="`Add a ${PIECE_CATALOG[type].label} piece`"
          @click="emit('add', type)"
          @mouseenter="emit('preview', type)"
          @mouseleave="emit('preview', null)"
        >
          <PiecePreviewIcon :type="type" />
          {{ PIECE_CATALOG[type].label }}
        </LobbyUIButton>
      </div>
    </section>

    <section v-if="selectedPiece" class="editor-palette__section">
      <h3 class="editor-palette__section-title">
        {{ PIECE_CATALOG[selectedPiece.type].label }}
      </h3>
      <div class="editor-palette__row" data-lui-row>
        <input
          id="piece-color"
          class="editor-palette__color"
          type="color"
          :value="selectedColorHex"
          title="Change the color of the selected piece"
          @input="handleColorInput"
        />
        <LobbyUIIconButton
          size="sm"
          title="Remove the selected piece from the track"
          @click="emit('deletePiece')"
        >
          <Trash2 class="editor-palette__icon" aria-hidden="true" />
        </LobbyUIIconButton>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.editor-palette {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  width: 17rem;
  max-height: 100%;
  padding: var(--spacing-2);
  overflow-y: auto;
}

.editor-palette__section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.editor-palette__section-title {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.editor-palette__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-1);
}

.editor-palette__row {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
}

.editor-palette__color {
  width: 2.5rem;
  height: 2rem;
  padding: 0;
  cursor: pointer;
  background: transparent;
  border: 2px solid var(--lui-button-border-color);
  border-radius: var(--lui-radius-sketch-small);
}

.editor-palette__icon {
  width: 1.1em;
  height: 1.1em;
  filter: drop-shadow(2px 2px 0 #000);
}
</style>
