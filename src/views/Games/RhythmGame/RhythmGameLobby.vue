<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import GameLobbyWizard from '@/components/GameLobbyWizard.vue'
import RhythmGameSummary from './RhythmGameSummary.vue'
import type { LobbyPlayer, LobbyConfigField } from '@/types/lobbyWizard'
import { MATCHMAKER_ROOM, SONGS, type RgSong, type RgDifficulty, type RgInstrument } from './config'
import type { RgPlayer } from '@/stores/rhythmGame'
import {
  midiStorageList,
  midiStorageLoad,
  midiStorageSave,
  midiStorageDelete,
  type MidiTrackMeta
} from './midiStorage'
import { getMidiTracks, parseMidiTrack, type MidiTrackInfo } from './parseMidi'
import type { RhythmNote } from './config'

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: LobbyPlayer[]
  rgPlayerList: RgPlayer[]
  roomId: string
  song: RgSong
  difficulty: RgDifficulty
  instrument: RgInstrument
  customSongName?: string
  showResults?: boolean
  winnerId?: string | null
  localPeerId?: string
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  'update:song': [value: RgSong]
  'update:difficulty': [value: RgDifficulty]
  'update:instrument': [value: RgInstrument]
  nameChange: []
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
  playAgain: []
  midiParsed: [notes: RhythmNote[], songName: string]
  'update:customSong': []
}>()

// ── IDB state ──────────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)
const tracks = ref<MidiTrackMeta[]>([])
const selectedId = ref('')

// ── Buffer + track state ───────────────────────────────────────────────────
const midiBuffer = ref<ArrayBuffer | null>(null)
const midiTracks = ref<MidiTrackInfo[]>([])
const selectedTrackIndex = ref<number | null>(null)

const loadTracks = async (): Promise<void> => {
  tracks.value = await midiStorageList()
  if (props.song === 'custom' && props.customSongName) {
    const match = tracks.value.find((t) => t.name === props.customSongName)
    if (match) selectedId.value = match.id
  }
}

const loadBuffer = async (id: string): Promise<void> => {
  const buf = await midiStorageLoad(id)
  if (!buf) return
  midiBuffer.value = buf
  midiTracks.value = getMidiTracks(buf)
  selectedTrackIndex.value = midiTracks.value[0]?.index ?? null
}

const applyTrack = (): void => {
  if (!midiBuffer.value || selectedTrackIndex.value === null) return
  const songName =
    tracks.value.find((t) => t.id === selectedId.value)?.name ?? props.customSongName ?? ''
  try {
    const notes = parseMidiTrack(midiBuffer.value, selectedTrackIndex.value, props.difficulty)
    emit('midiParsed', notes, songName)
  } catch {
    // track empty — nothing to do
  }
}

watch(() => props.difficulty, applyTrack)
watch(selectedTrackIndex, applyTrack)

onMounted(async () => {
  await loadTracks()
  if (selectedId.value) await loadBuffer(selectedId.value)
})

// ── IDB dropdown handlers ──────────────────────────────────────────────────
const handleSelectChange = async (event: Event): Promise<void> => {
  const value = (event.target as HTMLSelectElement).value
  if (value === '__upload__') {
    ;(event.target as HTMLSelectElement).value = selectedId.value
    fileInput.value?.click()
    return
  }
  selectedId.value = value
  if (!value) {
    midiBuffer.value = null
    midiTracks.value = []
    selectedTrackIndex.value = null
    emit('update:song', 'electric-pulse')
    return
  }
  await loadBuffer(value)
}

const handleFileChange = async (event: Event): Promise<void> => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (fileInput.value) fileInput.value.value = ''
  const name = file.name.replace(/\.midi?$/i, '')
  const buf = await file.arrayBuffer()
  const id = await midiStorageSave(name, buf)
  await loadTracks()
  selectedId.value = id
  midiBuffer.value = buf
  midiTracks.value = getMidiTracks(buf)
  selectedTrackIndex.value = midiTracks.value[0]?.index ?? null
}

const handleDelete = async (): Promise<void> => {
  if (!selectedId.value) return
  await midiStorageDelete(selectedId.value)
  selectedId.value = ''
  midiBuffer.value = null
  midiTracks.value = []
  selectedTrackIndex.value = null
  emit('update:song', 'electric-pulse')
  await loadTracks()
}

const handleTrackChange = (event: Event): void => {
  selectedTrackIndex.value = Number((event.target as HTMLSelectElement).value)
}

// ── Config fields ──────────────────────────────────────────────────────────
const songOptions = computed(() => {
  const presets = SONGS.map((s) => ({ value: s.id, label: s.label }))
  if (props.song === 'custom' && props.customSongName) {
    return [{ value: 'custom' as RgSong, label: `🎵 ${props.customSongName}` }, ...presets]
  }
  return presets
})

const configFields = computed((): LobbyConfigField[] => [
  {
    type: 'select',
    key: 'song',
    label: 'Song',
    value: props.song,
    options: songOptions.value
  },
  {
    type: 'select',
    key: 'difficulty',
    label: 'Difficulty',
    value: props.difficulty,
    options: [
      { value: 'easy', label: 'Easy' },
      { value: 'medium', label: 'Medium' },
      { value: 'hard', label: 'Hard' }
    ]
  },
  {
    type: 'select',
    key: 'instrument',
    label: 'Instrument',
    value: props.instrument,
    options: [
      { value: 'piano', label: 'Piano' },
      { value: 'bass', label: 'Bass' },
      { value: 'guitar', label: 'Guitar' }
    ]
  }
])

const handleConfig = (key: string, value: string | number): void => {
  if (key === 'song') emit('update:song', value as RgSong)
  if (key === 'difficulty') emit('update:difficulty', value as RgDifficulty)
  if (key === 'instrument') emit('update:instrument', value as RgInstrument)
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
    :config-fields="configFields"
    accent-color="var(--rg-accent)"
    :show-results="showResults"
    @update:player-name="emit('update:playerName', $event)"
    @update:player-color="emit('update:playerColor', $event)"
    @name-change="emit('nameChange')"
    @config-change="handleConfig"
    @start-game="emit('startGame')"
    @match-found="emit('matchFound', $event)"
    @leave-room="emit('leaveRoom')"
    @play-again="emit('playAgain')"
  >
    <template #config>
      <div class="rgl-midi">
        <label class="rgl-midi__label">MIDI Library</label>
        <div class="rgl-midi__row">
          <select class="rgl-midi__select" :value="selectedId" @change="handleSelectChange">
            <option value="">— Select a MIDI —</option>
            <option v-for="track in tracks" :key="track.id" :value="track.id">
              {{ track.name }}
            </option>
            <option value="__upload__">↑ Upload new MIDI…</option>
          </select>
          <button
            v-if="selectedId"
            class="rgl-midi__delete"
            type="button"
            title="Remove from library"
            @click="handleDelete"
          >
            ×
          </button>
        </div>

        <template v-if="midiTracks.length > 1">
          <label class="rgl-midi__label">Track</label>
          <select
            class="rgl-midi__select"
            :value="selectedTrackIndex ?? ''"
            @change="handleTrackChange"
          >
            <option v-for="t in midiTracks" :key="t.index" :value="t.index">
              {{ t.name }} ({{ t.noteCount }} notes)
            </option>
          </select>
        </template>

        <input
          ref="fileInput"
          type="file"
          accept=".mid,.midi"
          class="rgl-midi__input"
          @change="handleFileChange"
        />
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
.rgl-midi {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.rgl-midi__label {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--game-ink-muted, rgb(255, 255, 255, 0.5));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.rgl-midi__row {
  display: flex;
  gap: var(--spacing-1);
}

.rgl-midi__select {
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

.rgl-midi__delete {
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

.rgl-midi__delete:hover {
  background: #ff4040;
  border-color: #ff4040;
  color: #fff;
}

.rgl-midi__input {
  display: none;
}
</style>
