<script setup lang="ts">
import { computed } from 'vue'
import GameLobbyWizard from '@/components/GameLobbyWizard.vue'
import type { LobbyConfigField } from '@/types/lobbyWizard'
import type { MgPlayer } from '@/stores/minigolf'
import { MATCHMAKER_ROOM } from './constants'
import { HOLES } from './config'

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: MgPlayer[]
  roomId: string
  holeCount: number
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  'update:holeCount': [value: number]
  nameChange: []
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
}>()

const configFields = computed((): LobbyConfigField[] => [
  {
    type: 'number',
    key: 'holeCount',
    label: 'Holes',
    value: props.holeCount,
    min: 1,
    max: HOLES.length
  }
])

const handleConfig = (key: string, value: string | number): void => {
  if (key === 'holeCount') emit('update:holeCount', value as number)
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
    accent-color="var(--mg-green)"
    :config-fields="configFields"
    @update:player-name="emit('update:playerName', $event)"
    @update:player-color="emit('update:playerColor', $event)"
    @name-change="emit('nameChange')"
    @config-change="handleConfig"
    @start-game="emit('startGame')"
    @match-found="emit('matchFound', $event)"
    @leave-room="emit('leaveRoom')"
  >
    <template #rules>
      <ul>
        <li>Each player takes turns shooting their ball toward the hole</li>
        <li><strong>Drag</strong> on the canvas to aim and set power, then release to shoot</li>
        <li>Fewest total strokes across all holes wins</li>
        <li>Maximum {{ 10 }} strokes per hole — ball is holed automatically after that</li>
      </ul>
    </template>
  </GameLobbyWizard>
</template>
