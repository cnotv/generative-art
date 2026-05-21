<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import GameLobbyWizard from '@/components/GameLobbyWizard.vue'
import RhythmGameSummary from './RhythmGameSummary.vue'
import type { LobbyPlayer } from '@/types/lobbyWizard'
import { MATCHMAKER_ROOM } from './config'
import type { RgPlayer } from '@/stores/rhythmGame'
import {
  midiStorageList,
  midiStorageLoad,
  midiStorageSave,
  midiStorageDelete,
  type MidiLibraryEntry
} from './midiStorage'
import { getMidiTracks, parseMidiTrack, parseAllMidiNotes } from './parseMidi'
import type { RhythmNote } from './config'

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: LobbyPlayer[]
  rgPlayerList: RgPlayer[]
  roomId: string
  showResults?: boolean
  winnerId?: string | null
  localPeerId?: string
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  nameChange: []
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
  playAgain: []
  midiParsed: [gameNotes: RhythmNote[], backgroundNotes: RhythmNote[], songName: string]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const library = ref<MidiLibraryEntry[]>([])
const selectedMidiId = ref<string | null>(null)
const selectedTrackIndex = ref(0)

const loadLibrary = async (): Promise<void> => {
  library.value = await midiStorageList()
}

onMounted(loadLibrary)

const selectedEntry = computed(() => library.value.find((e) => e.id === selectedMidiId.value))
const availableTracks = computed(() => selectedEntry.value?.tracks ?? [])

const loadAndEmit = async (midiId: string, trackIndex: number, songName: string): Promise<void> => {
  const buf = await midiStorageLoad(midiId)
  if (!buf) return
  const gameNotes = parseMidiTrack(buf, trackIndex, 'hard')
  const backgroundNotes = parseAllMidiNotes(buf)
  emit('midiParsed', gameNotes, backgroundNotes, songName)
}

const resolveTrackLabel = (midiId: string, trackIndex: number): string => {
  const entry = library.value.find((e) => e.id === midiId)
  const trackInfo = entry?.tracks.find((t) => t.index === trackIndex)
  if (!entry) return ''
  return entry.tracks.length > 1
    ? `${entry.name} — ${trackInfo?.name ?? `Track ${trackIndex + 1}`}`
    : entry.name
}

const handleSongChange = async (event: Event): Promise<void> => {
  const value = (event.target as HTMLSelectElement).value
  if (value === '__upload__') {
    ;(event.target as HTMLSelectElement).value = selectedMidiId.value ?? ''
    fileInput.value?.click()
    return
  }
  selectedMidiId.value = value
  const entry = library.value.find((e) => e.id === value)
  const firstTrack = entry?.tracks[0]
  if (!firstTrack) return
  selectedTrackIndex.value = firstTrack.index
  await loadAndEmit(value, firstTrack.index, resolveTrackLabel(value, firstTrack.index))
}

const handleTrackChange = async (event: Event): Promise<void> => {
  if (!selectedMidiId.value) return
  const trackIndex = Number((event.target as HTMLSelectElement).value)
  selectedTrackIndex.value = trackIndex
  await loadAndEmit(
    selectedMidiId.value,
    trackIndex,
    resolveTrackLabel(selectedMidiId.value, trackIndex)
  )
}

const handleFileChange = async (event: Event): Promise<void> => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (fileInput.value) fileInput.value.value = ''
  const name = file.name.replace(/\.midi?$/i, '')
  const buf = await file.arrayBuffer()
  const tracks = getMidiTracks(buf)
  const id = await midiStorageSave(name, buf, tracks)
  await loadLibrary()
  const firstTrack = tracks[0]
  if (!firstTrack) return
  selectedMidiId.value = id
  selectedTrackIndex.value = firstTrack.index
  const trackLabel = tracks.length > 1 ? `${name} — ${firstTrack.name}` : name
  const gameNotes = parseMidiTrack(buf, firstTrack.index, 'hard')
  const backgroundNotes = parseAllMidiNotes(buf)
  emit('midiParsed', gameNotes, backgroundNotes, trackLabel)
}

const handleDelete = async (): Promise<void> => {
  if (!selectedMidiId.value) return
  await midiStorageDelete(selectedMidiId.value)
  selectedMidiId.value = null
  selectedTrackIndex.value = 0
  emit('midiParsed', [], [], '')
  await loadLibrary()
}
</script>

<template>
  <GameLobbyWizard
    :player-name="playerName"
    :player-color="playerColor"
    :is-host="isHost"
    :player-list="playerList"
    :room-id="roomId"
    :matchmaker-room="MATCHMAKER_ROOM"
    :config-fields="[]"
    accent-color="var(--rg-accent)"
    :show-results="showResults"
    @update:player-name="emit('update:playerName', $event)"
    @update:player-color="emit('update:playerColor', $event)"
    @name-change="emit('nameChange')"
    @start-game="emit('startGame')"
    @match-found="emit('matchFound', $event)"
    @leave-room="emit('leaveRoom')"
    @play-again="emit('playAgain')"
  >
    <template #config>
      <div class="rgl-field">
        <label class="rgl-field__label">Song</label>
        <div class="rgl-field__row">
          <select
            class="rgl-field__select"
            :value="selectedMidiId ?? ''"
            @change="handleSongChange"
          >
            <option value="" disabled>— Select a song —</option>

            <optgroup v-if="library.length" label="My Library">
              <option v-for="entry in library" :key="entry.id" :value="entry.id">
                {{ entry.name }}
              </option>
            </optgroup>

            <option value="__upload__">↑ Upload MIDI…</option>
          </select>

          <button
            v-if="selectedMidiId"
            class="rgl-field__delete"
            type="button"
            title="Remove from library"
            @click="handleDelete"
          >
            ×
          </button>
        </div>

        <input
          ref="fileInput"
          type="file"
          accept=".mid,.midi"
          class="rgl-field__input"
          @change="handleFileChange"
        />
      </div>

      <div v-if="selectedMidiId && availableTracks.length > 1" class="rgl-field">
        <label class="rgl-field__label">Channel</label>
        <select class="rgl-field__select" :value="selectedTrackIndex" @change="handleTrackChange">
          <option v-for="track in availableTracks" :key="track.index" :value="track.index">
            {{ track.name }} ({{ track.noteCount }}n)
          </option>
        </select>
      </div>
    </template>

    <template #summary>
      <RhythmGameSummary
        :player-list="rgPlayerList"
        :winner-id="winnerId ?? null"
        :local-peer-id="localPeerId ?? ''"
        :is-host="isHost"
        results-only
      />
    </template>
  </GameLobbyWizard>
</template>

<style scoped>
.rgl-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.rgl-field__label {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--game-ink-muted, rgb(255 255 255 / 50%));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.rgl-field__row {
  display: flex;
  gap: var(--spacing-1);
}

.rgl-field__select {
  flex: 1;
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid var(--game-border);
  border-radius: var(--radius-md);
  background: var(--game-surface-subtle);
  color: var(--game-ink);
  font-size: var(--font-size-sm);
  font-family: inherit;
  cursor: pointer;
}

.rgl-field__delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--game-border);
  border-radius: var(--radius-md);
  background: var(--game-surface-subtle);
  color: var(--game-ink);
  font-size: 1.1rem;
  cursor: pointer;
  font-family: inherit;
  flex-shrink: 0;
}

.rgl-field__delete:hover {
  background: var(--color-error, #ff4040);
  border-color: var(--color-error, #ff4040);
  color: #fff;
}

.rgl-field__input {
  display: none;
}
</style>
