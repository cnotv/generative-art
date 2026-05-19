<script setup lang="ts">
import { computed } from 'vue'
import GameLobbyWizard from '@/components/GameLobbyWizard.vue'
import type { LobbyConfigField } from '@/types/lobbyWizard'
import type { DictionaryDifficulty } from '@webgamekit/dictionary'
import type { PictionaryPlayer } from '@/stores/pictionary'
import { ROUND_DURATION_OPTIONS, WORD_COUNT_OPTIONS, HINT_COUNT_OPTIONS } from './constants'

const MATCHMAKER_ROOM = 'pictionary-matchmaker'

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: PictionaryPlayer[]
  roomId: string
  difficulty: DictionaryDifficulty
  totalRounds: number
  roundDuration: number
  wordCount: number
  hintCount: number
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  'update:difficulty': [value: DictionaryDifficulty]
  'update:totalRounds': [value: number]
  'update:roundDuration': [value: number]
  'update:wordCount': [value: number]
  'update:hintCount': [value: number]
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
    options: ROUND_DURATION_OPTIONS.map((s) => ({ value: s, label: `${s}s` }))
  },
  {
    type: 'select',
    key: 'wordCount',
    label: 'Words',
    value: props.wordCount,
    options: WORD_COUNT_OPTIONS.map((n) => ({ value: n, label: String(n) }))
  },
  {
    type: 'select',
    key: 'hintCount',
    label: 'Hints',
    value: props.hintCount,
    options: HINT_COUNT_OPTIONS.map((n) => ({ value: n, label: String(n) }))
  }
])

const handleConfig = (key: string, value: string | number): void => {
  if (key === 'difficulty') emit('update:difficulty', value as DictionaryDifficulty)
  else if (key === 'totalRounds') emit('update:totalRounds', value as number)
  else if (key === 'roundDuration') emit('update:roundDuration', value as number)
  else if (key === 'wordCount') emit('update:wordCount', value as number)
  else if (key === 'hintCount') emit('update:hintCount', value as number)
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
    accent-color="var(--pic-orange)"
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
