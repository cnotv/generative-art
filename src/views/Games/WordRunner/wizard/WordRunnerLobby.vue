<script setup lang="ts">
import { computed } from 'vue'
import { LobbyUIWizard } from '@/components/LobbyUI'
import '@/assets/styles/lobby-ui.scss'
import type { LobbyConfigField, LobbyConfigSelectOption, LobbyPlayer } from '@/types/lobbyWizard'
import { MATCHMAKER_ROOM } from '../config'

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: LobbyPlayer[]
  roomId: string
  language: string
  languageOptions: LobbyConfigSelectOption[]
  levelId: string
  levelOptions: LobbyConfigSelectOption[]
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  nameChange: []
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
  'config-change': [key: string, value: string | number]
}>()

const configFields = computed((): LobbyConfigField[] => [
  {
    type: 'select',
    key: 'language',
    label: 'Language',
    value: props.language,
    options: props.languageOptions
  },
  {
    type: 'select',
    key: 'levelId',
    label: 'Level',
    value: props.levelId,
    options: props.levelOptions
  }
])
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
    @update:player-name="emit('update:playerName', $event)"
    @update:player-color="emit('update:playerColor', $event)"
    @name-change="emit('nameChange')"
    @start-game="emit('startGame')"
    @match-found="emit('matchFound', $event)"
    @leave-room="emit('leaveRoom')"
    @config-change="(key, value) => emit('config-change', key, value)"
  >
  </LobbyUIWizard>
</template>
