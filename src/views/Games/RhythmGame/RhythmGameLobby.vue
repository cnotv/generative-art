<script setup lang="ts">
import { computed } from 'vue'
import GameLobbyWizard from '@/components/GameLobbyWizard.vue'
import type { LobbyPlayer, LobbyConfigField } from '@/types/lobbyWizard'
import { MATCHMAKER_ROOM, SONGS, type RgSong, type RgDifficulty } from './config'

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: LobbyPlayer[]
  roomId: string
  song: RgSong
  difficulty: RgDifficulty
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  'update:song': [value: RgSong]
  'update:difficulty': [value: RgDifficulty]
  nameChange: []
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
}>()

const configFields = computed((): LobbyConfigField[] => [
  {
    type: 'select',
    key: 'song',
    label: 'Song',
    value: props.song,
    options: SONGS.map((s) => ({ value: s.id, label: s.label }))
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
  }
])

const handleConfig = (key: string, value: string | number): void => {
  if (key === 'song') emit('update:song', value as RgSong)
  if (key === 'difficulty') emit('update:difficulty', value as RgDifficulty)
}
</script>

<template>
  <section class="rgl-lobby">
    <GameLobbyWizard
      :player-name="playerName"
      :player-color="playerColor"
      :is-host="isHost"
      :player-list="playerList"
      :room-id="roomId"
      :matchmaker-room="MATCHMAKER_ROOM"
      :config-fields="configFields"
      accent-color="var(--rg-accent)"
      @update:player-name="emit('update:playerName', $event)"
      @update:player-color="emit('update:playerColor', $event)"
      @name-change="emit('nameChange')"
      @config-change="handleConfig"
      @start-game="emit('startGame')"
      @match-found="emit('matchFound', $event)"
      @leave-room="emit('leaveRoom')"
    />
  </section>
</template>

<style scoped>
.rgl-lobby {
  grid-area: main;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}
</style>
