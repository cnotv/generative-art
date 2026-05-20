<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import GameLobbyWizard from '@/components/GameLobbyWizard.vue'
import RhythmGameSummary from './RhythmGameSummary.vue'
import type { LobbyPlayer, LobbyConfigField } from '@/types/lobbyWizard'
import { MATCHMAKER_ROOM, SONGS, type RgSong, type RgDifficulty, type RgInstrument } from './config'
import type { RgPlayer } from '@/stores/rhythmGame'
import { midiStorageList, midiStorageDelete, type MidiTrackMeta } from './midiStorage'

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
  midiUpload: [file: File]
  midiSelect: [id: string, name: string]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const tracks = ref<MidiTrackMeta[]>([])
const selectedId = ref('')

const loadTracks = async (): Promise<void> => {
  tracks.value = await midiStorageList()
  if (props.song === 'custom' && props.customSongName) {
    const match = tracks.value.find((t) => t.name === props.customSongName)
    if (match) selectedId.value = match.id
  }
}

onMounted(loadTracks)

const handleSelectChange = (event: Event): void => {
  const value = (event.target as HTMLSelectElement).value
  if (value === '__upload__') {
    ;(event.target as HTMLSelectElement).value = selectedId.value
    fileInput.value?.click()
    return
  }
  selectedId.value = value
  if (!value) {
    emit('update:song', 'electric-pulse')
    return
  }
  const track = tracks.value.find((t) => t.id === value)
  if (track) emit('midiSelect', track.id, track.name)
}

const handleFileChange = async (event: Event): Promise<void> => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  emit('midiUpload', file)
  if (fileInput.value) fileInput.value.value = ''
  await loadTracks()
  if (props.customSongName) {
    const match = tracks.value.find((t) => t.name === props.customSongName)
    if (match) selectedId.value = match.id
  }
}

const handleDelete = async (): Promise<void> => {
  if (!selectedId.value) return
  await midiStorageDelete(selectedId.value)
  selectedId.value = ''
  emit('update:song', 'electric-pulse')
  await loadTracks()
}

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
