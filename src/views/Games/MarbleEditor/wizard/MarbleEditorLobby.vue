<script setup lang="ts">
import { computed } from 'vue'
import {
  LobbyUIWizard,
  LobbyUIRow,
  LobbyUIOptionToggle,
  LobbyUIImageGrid
} from '@/components/LobbyUI'
import '@/assets/styles/lobby-ui.scss'
import type { LobbyPlayer, LobbyConfigField } from '@/types/lobbyWizard'
import { MATCHMAKER_ROOM, CONTROLS_CONFIG } from '../config'
import { MARBLE_OPTIONS } from '../../MarbleMadness/config'
import type { MePhase } from '../types'

const props = defineProps<{
  playerName: string
  playerColor: string
  playerMarble: string
  isHost: boolean
  playerList: LobbyPlayer[]
  roomId: string
  startMode: Extract<MePhase, 'edit' | 'race'>
  mapOptions: { value: number; label: string }[]
  selectedMapIndex: number
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  nameChange: []
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
  'config-change': [key: string, value: string | number]
  'marble-change': [marbleId: string]
  'mode-change': [mode: Extract<MePhase, 'edit' | 'race'>]
}>()

const START_MODE_OPTIONS = [
  { value: 'edit', label: 'Build' },
  { value: 'race', label: 'Race' }
]

const configFields = computed((): LobbyConfigField[] => [
  {
    type: 'select',
    key: 'mapIndex',
    label: 'Map',
    value: props.selectedMapIndex,
    options: props.mapOptions
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
    :controls="CONTROLS_CONFIG"
    @update:player-name="emit('update:playerName', $event)"
    @update:player-color="emit('update:playerColor', $event)"
    @name-change="emit('nameChange')"
    @start-game="emit('startGame')"
    @match-found="emit('matchFound', $event)"
    @leave-room="emit('leaveRoom')"
    @config-change="(key, value) => emit('config-change', key, value)"
  >
    <template #profile-extra>
      <LobbyUIRow label="Start in">
        <LobbyUIOptionToggle
          :model-value="startMode"
          :options="START_MODE_OPTIONS"
          @update:model-value="emit('mode-change', $event as Extract<MePhase, 'edit' | 'race'>)"
        />
      </LobbyUIRow>

      <LobbyUIRow label="Marble">
        <LobbyUIImageGrid
          :model-value="playerMarble"
          :items="MARBLE_OPTIONS"
          @update:model-value="emit('marble-change', $event)"
        />
      </LobbyUIRow>
    </template>
  </LobbyUIWizard>
</template>
