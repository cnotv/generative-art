<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import GameLobbyWizard from '@/components/GameLobbyWizard.vue'
import RhythmGameSummary from './RhythmGameSummary.vue'
import type { LobbyPlayer } from '@/types/lobbyWizard'
import { MATCHMAKER_ROOM, type RgInstrument } from './config'
import type { RgPlayer } from '@/stores/rhythmGame'
import {
  midiStorageList,
  midiStorageLoad,
  midiStorageSave,
  midiStorageDelete,
  type MidiLibraryEntry
} from './midiStorage'
import { getMidiTracks, parseMidiTrack } from './parseMidi'
import type { RhythmNote } from './config'

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: LobbyPlayer[]
  rgPlayerList: RgPlayer[]
  roomId: string
  instrument: RgInstrument
  showResults?: boolean
  winnerId?: string | null
  localPeerId?: string
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  'update:instrument': [value: RgInstrument]
  nameChange: []
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
  playAgain: []
  midiParsed: [notes: RhythmNote[], songName: string]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const library = ref<MidiLibraryEntry[]>([])
const selectedValue = ref('')

const loadLibrary = async (): Promise<void> => {
  library.value = await midiStorageList()
}

onMounted(loadLibrary)

const selectedLibraryId = computed(() => {
  const [type, id] = selectedValue.value.split(':')
  return type === 'midi' ? id : null
})

const parseMidiOption = async (
  midiId: string,
  trackIndex: number,
  songName: string
): Promise<void> => {
  const buf = await midiStorageLoad(midiId)
  if (!buf) return
  const notes = parseMidiTrack(buf, trackIndex, 'hard')
  emit('midiParsed', notes, songName)
}

const buildTrackLabel = (midiId: string, trackIndex: number): string => {
  const entry = library.value.find((e) => e.id === midiId)
  const trackInfo = entry?.tracks.find((t) => t.index === trackIndex)
  if (!entry) return ''
  return entry.tracks.length > 1
    ? `${entry.name} — ${trackInfo?.name ?? `Track ${trackIndex + 1}`}`
    : entry.name
}

const handleMidiSelection = async (midiId: string, trackIndex: number): Promise<void> => {
  await parseMidiOption(midiId, trackIndex, buildTrackLabel(midiId, trackIndex))
}

const handleChange = async (event: Event): Promise<void> => {
  const value = (event.target as HTMLSelectElement).value
  if (value === '__upload__') {
    ;(event.target as HTMLSelectElement).value = selectedValue.value
    fileInput.value?.click()
    return
  }
  selectedValue.value = value
  const [type, id, trackString] = value.split(':')
  if (type === 'midi') await handleMidiSelection(id, Number(trackString))
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
  selectedValue.value = `midi:${id}:${firstTrack.index}`
  const trackLabel = tracks.length > 1 ? `${name} — ${firstTrack.name}` : name
  const notes = parseMidiTrack(buf, firstTrack.index, 'hard')
  emit('midiParsed', notes, trackLabel)
}

const handleDelete = async (): Promise<void> => {
  if (!selectedLibraryId.value) return
  await midiStorageDelete(selectedLibraryId.value)
  selectedValue.value = ''
  emit('midiParsed', [], '')
  await loadLibrary()
}

const handleInstrumentChange = (event: Event): void => {
  emit('update:instrument', (event.target as HTMLSelectElement).value as RgInstrument)
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
          <select class="rgl-field__select" :value="selectedValue" @change="handleChange">
            <option value="" disabled>— Select a song —</option>

            <optgroup v-if="library.length" label="My Library">
              <template v-for="entry in library" :key="entry.id">
                <option
                  v-if="entry.tracks.length <= 1"
                  :value="`midi:${entry.id}:${entry.tracks[0]?.index ?? 0}`"
                >
                  {{ entry.name }}
                </option>
                <option
                  v-for="track in entry.tracks"
                  v-else
                  :key="track.index"
                  :value="`midi:${entry.id}:${track.index}`"
                >
                  {{ entry.name }} — {{ track.name }} ({{ track.noteCount }}n)
                </option>
              </template>
            </optgroup>

            <option value="__upload__">↑ Upload MIDI…</option>
          </select>

          <button
            v-if="selectedLibraryId"
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

      <div class="rgl-field">
        <label class="rgl-field__label">Instrument</label>
        <select class="rgl-field__select" :value="instrument" @change="handleInstrumentChange">
          <option value="piano">Piano</option>
          <option value="bass">Bass</option>
          <option value="guitar">Guitar</option>
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
