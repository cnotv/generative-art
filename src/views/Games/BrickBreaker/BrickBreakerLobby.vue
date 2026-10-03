<script setup lang="ts">
import { computed } from 'vue'
import { LobbyUIWizard } from '@/components/LobbyUI'
import '@/assets/styles/lobby-ui.scss'
import type { LobbyConfigField, LobbyPlayer } from '@/types/lobbyWizard'
import { MATCHMAKER_ROOM, CONTROLS_CONFIG } from './config'
import type { BbMatchLength } from './types'

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: LobbyPlayer[]
  roomId: string
  matchLength: BbMatchLength
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  'update:matchLength': [value: BbMatchLength]
  nameChange: []
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
}>()

const MATCH_LENGTHS: BbMatchLength[] = ['endless', 'sprint']

const configFields = computed((): LobbyConfigField[] => [
  {
    type: 'select',
    key: 'matchLength',
    label: 'Match',
    value: props.matchLength,
    options: [
      { value: 'endless', label: 'Last one standing' },
      { value: 'sprint', label: '2-minute sprint' }
    ]
  }
])

const handleConfig = (key: string, value: string | number): void => {
  const matchLength = MATCH_LENGTHS.find((length) => length === value)
  if (key === 'matchLength' && matchLength) emit('update:matchLength', matchLength)
}
</script>

<template>
  <LobbyUIWizard
    :player-name="playerName"
    :player-color="playerColor"
    :is-host="isHost"
    :player-list="playerList"
    :room-id="roomId"
    :matchmaker-room="MATCHMAKER_ROOM"
    :config-fields="configFields"
    :controls="CONTROLS_CONFIG"
    @update:player-name="emit('update:playerName', $event)"
    @update:player-color="emit('update:playerColor', $event)"
    @name-change="emit('nameChange')"
    @config-change="handleConfig"
    @start-game="emit('startGame')"
    @match-found="emit('matchFound', $event)"
    @leave-room="emit('leaveRoom')"
  />
</template>
