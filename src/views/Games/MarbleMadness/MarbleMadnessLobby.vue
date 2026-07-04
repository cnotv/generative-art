<script setup lang="ts">
import { ref } from 'vue'
import {
  LobbyUIWizard,
  LobbyUIRow,
  LobbyUIOptionToggle,
  LobbyUIImageGrid,
  LobbyUIButton
} from '@/components/LobbyUI'
import ControlsMapperDialog from '@/components/ControlsMapper/ControlsMapperDialog.vue'
import '@/assets/styles/lobby-ui.scss'
import type { LobbyPlayer } from '@/types/lobbyWizard'
import {
  MATCHMAKER_ROOM,
  TRACK_SELECT_FIELD,
  MARBLE_OPTIONS,
  CONTROLS_GAME_ID,
  CONTROLS_ACTIONS,
  KEYBOARD_MAPPING
} from './config'
import type { GameMode } from './types'

const controlsOpen = ref(false)

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

      <LobbyUIRow label="Controls">
        <LobbyUIButton variant="ghost" @click="controlsOpen = true">Configure</LobbyUIButton>
      </LobbyUIRow>
    </template>
  </LobbyUIWizard>

  <Teleport to="body">
    <ControlsMapperDialog
      v-if="controlsOpen"
      :game-id="CONTROLS_GAME_ID"
      :actions="CONTROLS_ACTIONS"
      :default-mapping="KEYBOARD_MAPPING"
      title="Marble Controls"
      @close="controlsOpen = false"
    />
  </Teleport>
</template>
