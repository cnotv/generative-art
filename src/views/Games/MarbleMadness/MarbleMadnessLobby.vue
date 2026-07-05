<script setup lang="ts">
import {
  LobbyUIWizard,
  LobbyUIRow,
  LobbyUIOptionToggle,
  LobbyUIImageGrid
} from '@/components/LobbyUI'
import '@/assets/styles/lobby-ui.scss'
import type { LobbyPlayer } from '@/types/lobbyWizard'
import { MATCHMAKER_ROOM, TRACK_SELECT_FIELD, MARBLE_OPTIONS, CONTROLS_CONFIG } from './config'
import type { GameMode } from './types'

const props = defineProps<{
  playerName: string
  playerColor: string
  playerMarble: string
  takenMarbles: string[]
  isHost: boolean
  playerList: LobbyPlayer[]
  roomId: string
  mode: GameMode
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
  'mode-change': [mode: GameMode]
}>()

const isSolo = (): boolean => props.playerList.length <= 1

const MODE_OPTIONS = [
  { value: 'race', label: 'Race' },
  { value: 'rush', label: 'Rush' }
]
</script>

<template>
  <LobbyUIWizard
    :player-name="playerName"
    :player-color="playerColor"
    :is-host="isHost"
    :player-list="playerList"
    :room-id="roomId"
    :matchmaker-room="MATCHMAKER_ROOM"
    :config-fields="mode === 'race' ? [TRACK_SELECT_FIELD] : []"
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
      <LobbyUIRow v-if="isSolo()" label="Mode">
        <LobbyUIOptionToggle
          :model-value="mode"
          :options="MODE_OPTIONS"
          @update:model-value="emit('mode-change', $event as GameMode)"
        />
      </LobbyUIRow>

      <LobbyUIRow label="Marble">
        <LobbyUIImageGrid
          :model-value="playerMarble"
          :items="MARBLE_OPTIONS"
          :is-item-disabled="(id) => id !== playerMarble && takenMarbles.includes(id)"
          @update:model-value="emit('marble-change', $event)"
        />
      </LobbyUIRow>
    </template>
  </LobbyUIWizard>
</template>
