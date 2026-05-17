<script setup lang="ts">
import GameLobbyWizard from '@/components/GameLobbyWizard.vue'
import type { LobbyPlayer } from '@/types/lobbyWizard'
import { MATCHMAKER_ROOM, GOOMBA_COUNT, PLANNING_DURATION_S, BATTLE_DURATION_S } from './constants'

defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: LobbyPlayer[]
  roomId: string
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  nameChange: []
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
}>()
</script>

<template>
  <GameLobbyWizard
    :player-name="playerName"
    :player-color="playerColor"
    :is-host="isHost"
    :player-list="playerList"
    :room-id="roomId"
    :matchmaker-room="MATCHMAKER_ROOM"
    accent-color="var(--pf-orange, #e67e22)"
    :config-fields="[]"
    @update:player-name="emit('update:playerName', $event)"
    @update:player-color="emit('update:playerColor', $event)"
    @name-change="emit('nameChange')"
    @start-game="emit('startGame')"
    @match-found="emit('matchFound', $event)"
    @leave-room="emit('leaveRoom')"
  >
    <template #rules>
      <ul>
        <li>
          Each player draws a path for each of their {{ GOOMBA_COUNT }} goombas ({{
            PLANNING_DURATION_S
          }}s timer)
        </li>
        <li>
          Submit early with the <strong>Ready</strong> button — battle starts when both players are
          ready
        </li>
        <li>Goombas march along their paths and push items across the stage</li>
        <li>
          Items pushed off the <em>far edge</em> score for you — items pushed off
          <em>your own edge</em> score for the opponent
        </li>
        <li>Battle lasts {{ BATTLE_DURATION_S }} seconds</li>
      </ul>
    </template>
  </GameLobbyWizard>
</template>
