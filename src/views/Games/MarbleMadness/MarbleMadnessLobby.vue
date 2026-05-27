<script setup lang="ts">
import GameLobbyWizard from '@/components/GameLobbyWizard.vue'
import type { LobbyPlayer } from '@/types/lobbyWizard'
import { MATCHMAKER_ROOM, TRACK_SELECT_FIELD, MARBLE_OPTIONS } from './config'

const props = defineProps<{
  playerName: string
  playerColor: string
  playerMarble: string
  takenMarbles: string[]
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
  'config-change': [key: string, value: string | number]
  'marble-change': [marbleId: string]
}>()

const isAvailable = (marbleId: string): boolean =>
  marbleId === props.playerMarble || !props.takenMarbles.includes(marbleId)
</script>

<template>
  <GameLobbyWizard
    :player-name="playerName"
    :player-color="playerColor"
    :is-host="isHost"
    :player-list="playerList"
    :room-id="roomId"
    :matchmaker-room="MATCHMAKER_ROOM"
    :config-fields="[TRACK_SELECT_FIELD]"
    accent-color="var(--mm-accent)"
    @update:player-name="emit('update:playerName', $event)"
    @update:player-color="emit('update:playerColor', $event)"
    @name-change="emit('nameChange')"
    @start-game="emit('startGame')"
    @match-found="emit('matchFound', $event)"
    @leave-room="emit('leaveRoom')"
    @config-change="(key, value) => emit('config-change', key, value)"
  >
    <template #profile-extra>
      <div class="mml__marble-picker">
        <span class="mml__marble-label">Your marble</span>
        <div class="mml__marble-grid">
          <button
            v-for="marble in MARBLE_OPTIONS"
            :key="marble.id"
            class="mml__marble-btn"
            :class="{
              'mml__marble-btn--active': playerMarble === marble.id,
              'mml__marble-btn--taken': !isAvailable(marble.id)
            }"
            :title="isAvailable(marble.id) ? marble.name : `${marble.name} (taken)`"
            type="button"
            :disabled="!isAvailable(marble.id)"
            @click="emit('marble-change', marble.id)"
          >
            <img :src="marble.url" :alt="marble.name" class="mml__marble-img" />
          </button>
        </div>
        <span class="mml__marble-selected-name">
          {{ MARBLE_OPTIONS.find((m) => m.id === playerMarble)?.name }}
        </span>
      </div>
    </template>
  </GameLobbyWizard>
</template>

<style scoped>
.mml__marble-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.mml__marble-label {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--game-ink);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mml__marble-selected-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--game-ink-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: center;
}

.mml__marble-grid {
  display: flex;
  gap: var(--spacing-3);
  flex-wrap: wrap;
}

.mml__marble-btn {
  position: relative;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  cursor: pointer;
  box-shadow: 2px 4px 8px rgb(0 0 0 / 0.45);
  transition:
    transform 0.15s,
    opacity 0.15s;
  flex-shrink: 0;
}

.mml__marble-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 32%, rgb(255 255 255 / 0.55) 0%, transparent 52%),
    radial-gradient(circle at 68% 72%, rgb(0 0 0 / 0.28) 0%, transparent 45%);
  pointer-events: none;
}

.mml__marble-btn:hover:not(:disabled) {
  transform: scale(1.2);
}

.mml__marble-btn--active {
  transform: scale(1.3);
}

.mml__marble-btn--taken {
  opacity: 0.25;
  cursor: not-allowed;
}

.mml__marble-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 50%;
}
</style>
