<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Undo2, Redo2, Plus, Trash2, Save, Play } from 'lucide-vue-next'
import {
  LobbyUIButton,
  LobbyUIIconButton,
  LobbyUIConfigField,
  LobbyUIKeyPill
} from '@/components/LobbyUI'
import type { LobbyConfigField } from '@/types/lobbyWizard'
import { SAMPLE_MAPS } from '../sampleMaps'
import type { MarbleMap } from '../types'

const props = defineProps<{
  canUndo: boolean
  canRedo: boolean
  savedMaps: MarbleMap[]
  mapName: string
  naming: boolean
}>()

const emit = defineEmits<{
  undo: []
  redo: []
  newMap: []
  play: []
  loadMap: [map: MarbleMap]
  deleteMap: [name: string]
  saveAs: [name: string]
  createTrack: [name: string]
  cancelNaming: []
}>()

const newTrackName = ref('')
const nameInputReference = ref<HTMLInputElement | null>(null)

const allMaps = computed(() => [...SAMPLE_MAPS, ...props.savedMaps])

const trackField = computed((): LobbyConfigField => {
  const knownNames = allMaps.value.map((map) => map.name)
  const currentEntry = knownNames.includes(props.mapName)
    ? []
    : [{ value: props.mapName, label: props.mapName }]
  return {
    type: 'select',
    key: 'track',
    label: 'Track',
    value: props.mapName,
    options: [...currentEntry, ...knownNames.map((name) => ({ value: name, label: name }))]
  }
})

const isSavedTrack = computed(() => props.savedMaps.some((map) => map.name === props.mapName))

const handleTrackChange = (_key: string, value: string | number): void => {
  if (value === props.mapName) return
  const map = allMaps.value.find((candidate) => candidate.name === value)
  if (map) emit('loadMap', map)
}

const confirmCreate = (): void => {
  emit('createTrack', newTrackName.value)
  newTrackName.value = ''
}

watch(
  () => props.naming,
  async (isNaming) => {
    if (!isNaming) return
    await nextTick()
    nameInputReference.value?.focus()
  }
)
</script>

<template>
  <div class="editor-toolbar">
    <template v-if="naming">
      <input
        ref="nameInputReference"
        v-model="newTrackName"
        class="editor-toolbar__input"
        type="text"
        placeholder="New track name"
        title="Name for the new track"
        @keyup.enter="confirmCreate"
        @keyup.esc="emit('cancelNaming')"
      />
      <LobbyUIButton size="sm" variant="ghost" title="Create the new track" @click="confirmCreate">
        Create
      </LobbyUIButton>
    </template>
    <template v-else>
      <LobbyUIConfigField :field="trackField" size="sm" @change="handleTrackChange" />
      <LobbyUIButton
        size="sm"
        variant="ghost"
        title="Save the current track (S / Square)"
        @click="emit('saveAs', mapName)"
      >
        <Save class="editor-toolbar__icon" aria-hidden="true" />
        Save
        <LobbyUIKeyPill :keyboard="['S']" :gamepad="['□']" />
      </LobbyUIButton>
      <div v-if="isSavedTrack" class="editor-toolbar__action">
        <LobbyUIIconButton
          size="sm"
          :title="`Delete the saved track ${mapName} (Delete / Circle)`"
          @click="emit('deleteMap', mapName)"
        >
          <Trash2 class="editor-toolbar__icon" aria-hidden="true" />
        </LobbyUIIconButton>
        <LobbyUIKeyPill :keyboard="['Del']" :gamepad="['○']" />
      </div>
    </template>
    <LobbyUIButton
      size="sm"
      variant="ghost"
      title="Start a new empty track (N / Triangle)"
      @click="emit('newMap')"
    >
      <Plus class="editor-toolbar__icon" aria-hidden="true" />
      New
      <LobbyUIKeyPill :keyboard="['N']" :gamepad="['△']" />
    </LobbyUIButton>
    <div class="editor-toolbar__action">
      <LobbyUIIconButton
        title="Undo the last edit (Z / L1)"
        :disabled="!canUndo"
        @click="emit('undo')"
      >
        <Undo2 class="editor-toolbar__icon" aria-hidden="true" />
      </LobbyUIIconButton>
      <LobbyUIKeyPill :keyboard="['Z']" :gamepad="['L1']" />
    </div>
    <div class="editor-toolbar__action">
      <LobbyUIIconButton
        title="Redo the undone edit (Y / R1)"
        :disabled="!canRedo"
        @click="emit('redo')"
      >
        <Redo2 class="editor-toolbar__icon" aria-hidden="true" />
      </LobbyUIIconButton>
      <LobbyUIKeyPill :keyboard="['Y']" :gamepad="['R1']" />
    </div>
    <LobbyUIButton
      variant="cta"
      size="sm"
      title="Race the current track (Options)"
      @click="emit('play')"
    >
      <Play class="editor-toolbar__icon" aria-hidden="true" />
      Play
      <LobbyUIKeyPill :gamepad="['Opt']" />
    </LobbyUIButton>
  </div>
</template>

<style scoped>
.editor-toolbar {
  display: flex;
  gap: var(--spacing-3);
  align-items: center;
}

.editor-toolbar__action {
  display: flex;
  flex-direction: column;
  gap: 0.15em;
  align-items: center;
}

.editor-toolbar__icon {
  width: 1.3em;
  height: 1.3em;
  filter: drop-shadow(2px 2px 0 #000);
}

.editor-toolbar__input {
  min-width: 0;
  width: 11rem;
  padding: var(--spacing-1) var(--spacing-2);
  font-family: var(--lui-font);
  font-size: var(--lui-text-tiny);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  background: transparent;
  border: 2px solid var(--lui-button-border-color);
  border-radius: var(--lui-radius-sketch-small);
}

.editor-toolbar__input:focus,
.editor-toolbar__input:focus-visible {
  color: var(--lui-focus-color);
  border-color: var(--lui-focus-color);
  outline: none;
}

.editor-toolbar__input::placeholder {
  color: var(--lui-stroke-faint);
}
</style>
