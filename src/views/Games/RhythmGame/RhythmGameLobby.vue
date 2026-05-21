<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
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
}>()

// ── State ─────────────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)
const library = ref<MidiLibraryEntry[]>([])
const selectedValue = ref('')

const loadLibrary = async (): Promise<void> => {
  library.value = await midiStorageList()
}

onMounted(loadLibrary)

// ── Combined value helpers ─────────────────────────────────────────────────
// Value format: "preset:<songId>"  |  "midi:<id>:<trackIndex>"  |  "__upload__"

const currentSelectedValue = computed(() => {
  if (props.song === 'custom') return selectedValue.value
  return `preset:${props.song}`
})

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
  const notes = parseMidiTrack(buf, trackIndex, props.difficulty)
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
    ;(event.target as HTMLSelectElement).value = currentSelectedValue.value
    fileInput.value?.click()
    return
  }
  selectedValue.value = value
  const [type, id, trackString] = value.split(':')
  if (type === 'preset') {
    emit('update:song', id as RgSong)
    return
  }
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
  const value = `midi:${id}:${firstTrack.index}`
  selectedValue.value = value
  const trackLabel = tracks.length > 1 ? `${name} — ${firstTrack.name}` : name
  const notes = parseMidiTrack(buf, firstTrack.index, props.difficulty)
  emit('midiParsed', notes, trackLabel)
}

const handleDelete = async (): Promise<void> => {
  if (!selectedLibraryId.value) return
  await midiStorageDelete(selectedLibraryId.value)
  selectedValue.value = ''
  emit('update:song', 'electric-pulse')
  await loadLibrary()
}

// ── Config fields (difficulty + instrument only, song handled above) ────────
const configFields = computed((): LobbyConfigField[] => [
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
      <div class="rgl-song">
        <label class="rgl-song__label">Song</label>
        <div class="rgl-song__row">
          <select class="rgl-song__select" :value="currentSelectedValue" @change="handleChange">
            <optgroup label="Presets">
              <option v-for="s in SONGS" :key="s.id" :value="`preset:${s.id}`">
                {{ s.label }}
              </option>
            </optgroup>

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
            class="rgl-song__delete"
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
          class="rgl-song__input"
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
.rgl-song {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.rgl-song__label {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--game-ink-muted, rgb(255, 255, 255, 0.5));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.rgl-song__row {
  display: flex;
  gap: var(--spacing-1);
}

.rgl-song__select {
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

.rgl-song__delete {
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

.rgl-song__delete:hover {
  background: #ff4040;
  border-color: #ff4040;
  color: #fff;
}

.rgl-song__input {
  display: none;
}
</style>
