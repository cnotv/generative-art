<script setup lang="ts">
import { computed, ref } from 'vue'
import GameLobbyWizard from '@/components/GameLobbyWizard.vue'
import RhythmGameSummary from './RhythmGameSummary.vue'
import type { LobbyPlayer, LobbyConfigField } from '@/types/lobbyWizard'
import { MATCHMAKER_ROOM, SONGS, type RgSong, type RgDifficulty, type RgInstrument } from './config'
import type { RgPlayer } from '@/stores/rhythmGame'

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
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const parseError = ref('')

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

const handleFileChange = (event: Event): void => {
  parseError.value = ''
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.name.match(/\.midi?$/i)) {
    parseError.value = 'Please select a .mid or .midi file'
    return
  }
  emit('midiUpload', file)
  if (fileInput.value) fileInput.value.value = ''
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
        <label class="rgl-midi__label">Custom MIDI</label>
        <label class="rgl-midi__btn" title="Upload a .mid file to play it">
          <input
            ref="fileInput"
            type="file"
            accept=".mid,.midi"
            class="rgl-midi__input"
            @change="handleFileChange"
          />
          {{ song === 'custom' && customSongName ? `🎵 ${customSongName}` : '↑ Upload .mid file' }}
        </label>
        <p v-if="parseError" class="rgl-midi__error">{{ parseError }}</p>
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

.rgl-midi__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px dashed var(--game-border);
  border-radius: var(--radius-md);
  background: var(--game-surface-subtle);
  color: var(--game-ink);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s ease;
}

.rgl-midi__btn:hover {
  border-color: var(--rg-accent, var(--game-accent));
}

.rgl-midi__input {
  display: none;
}

.rgl-midi__error {
  font-size: var(--font-size-xs);
  color: #ff4081;
  margin: 0;
}
</style>
