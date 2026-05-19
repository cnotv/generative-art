<script setup lang="ts">
import { computed } from 'vue'
import GameLobbyWizard from '@/components/GameLobbyWizard.vue'
import type { LobbyPlayer } from '@/types/lobbyWizard'
import type { LobbyConfigField } from '@/types/lobbyWizard'
import { MATCHMAKER_ROOM, type BsColorCount, type BsSpeed } from './config'

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: LobbyPlayer[]
  roomId: string
  colorCount: BsColorCount
  speed: BsSpeed
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  'update:colorCount': [value: BsColorCount]
  'update:speed': [value: BsSpeed]
  nameChange: []
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
}>()

const configFields = computed((): LobbyConfigField[] => [
  {
    type: 'select',
    key: 'colorCount',
    label: 'Colors',
    value: props.colorCount,
    options: [
      { value: 3, label: '3 colors — easier' },
      { value: 4, label: '4 colors' },
      { value: 5, label: '5 colors — harder' }
    ]
  },
  {
    type: 'select',
    key: 'speed',
    label: 'Speed',
    value: props.speed,
    options: [
      { value: 'slow', label: 'Slow — rows drop rarely' },
      { value: 'medium', label: 'Medium' },
      { value: 'fast', label: 'Fast — rows drop quickly' }
    ]
  }
])

const handleConfig = (key: string, value: string | number): void => {
  if (key === 'colorCount') emit('update:colorCount', Number(value) as BsColorCount)
  if (key === 'speed') emit('update:speed', value as BsSpeed)
}
</script>

<template>
  <section class="bs-lobby">
    <GameLobbyWizard
      :player-name="playerName"
      :player-color="playerColor"
      :is-host="isHost"
      :player-list="playerList"
      :room-id="roomId"
      :matchmaker-room="MATCHMAKER_ROOM"
      :config-fields="configFields"
      accent-color="var(--bs-accent)"
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
.bs-lobby {
  grid-area: main;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}
</style>
