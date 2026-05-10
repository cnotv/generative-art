<script setup lang="ts">
import { computed } from 'vue'
import GameLobbyWizard from '@/components/GameLobbyWizard.vue'
import type { LobbyConfigField } from '@/types/lobbyWizard'
import type { DictionaryDifficulty } from '@webgamekit/dictionary'
import type { WmPlayer } from '@/stores/squaresMultiplayer'
import { ROUND_DURATION_OPTIONS, MATCHMAKER_ROOM } from './constants'

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: WmPlayer[]
  roomId: string
  difficulty: DictionaryDifficulty
  totalRounds: number
  roundDuration: number
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  'update:difficulty': [value: DictionaryDifficulty]
  'update:totalRounds': [value: number]
  'update:roundDuration': [value: number]
  nameChange: []
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
}>()

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
    type: 'number',
    key: 'totalRounds',
    label: 'Rounds',
    value: props.totalRounds,
    min: 1,
    max: 20
  },
  {
    type: 'select',
    key: 'roundDuration',
    label: 'Round time',
    value: props.roundDuration,
    options: ROUND_DURATION_OPTIONS.map((s) => ({
      value: s,
      label: s === 0 ? 'No limit' : `${s}s`
    }))
  }
])

const handleConfig = (key: string, value: string | number): void => {
  if (key === 'difficulty') emit('update:difficulty', value as DictionaryDifficulty)
  else if (key === 'totalRounds') emit('update:totalRounds', value as number)
  else if (key === 'roundDuration') emit('update:roundDuration', value as number)
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
    accent-color="var(--ws-green)"
    :config-fields="configFields"
    @update:player-name="emit('update:playerName', $event)"
    @update:player-color="emit('update:playerColor', $event)"
    @name-change="emit('nameChange')"
    @config-change="handleConfig"
    @start-game="emit('startGame')"
    @match-found="emit('matchFound', $event)"
    @leave-room="emit('leaveRoom')"
  />
</template>
