<script setup lang="ts">
import { computed } from 'vue'
import { LobbyUIWizard } from '@/components/LobbyUI'
import '@/assets/styles/lobby-ui.scss'
import type { LobbyPlayer, LobbyConfigField } from '@/types/lobbyWizard'
import { MATCHMAKER_ROOM, CONTROLS_CONFIG, CHARACTER_TYPES } from '../config'
import { rockSurfaceOptions } from '../elements/rockSurfaces'
import { stickmanSkinOptions } from '../elements/stickmanSkins'

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: LobbyPlayer[]
  roomId: string
  trackSeed: number
  rockSurface: string
  characterType: string
  stickmanSkin: string
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
    key: 'characterType',
    label: 'Character',
    value: props.characterType,
    options: CHARACTER_TYPES
  },
  // One "Skin" field, but which one depends on who's riding the sphere:
  // the rock's own surface, or the stickman's catalogue texture. Never both
  // at once — a surface pick means nothing once the rock itself is hidden.
  ...(props.characterType === 'stickman'
    ? [
        {
          type: 'select' as const,
          key: 'stickmanSkin',
          label: 'Skin',
          value: props.stickmanSkin,
          options: stickmanSkinOptions()
        }
      ]
    : [
        {
          type: 'select' as const,
          key: 'rockSurface',
          label: 'Skin',
          value: props.rockSurface,
          options: rockSurfaceOptions()
        }
      ]),
  {
    type: 'number',
    key: 'trackSeed',
    label: 'Track seed',
    value: props.trackSeed,
    min: 1,
    max: 9999
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
  </LobbyUIWizard>
</template>
