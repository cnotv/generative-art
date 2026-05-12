<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check } from 'lucide-vue-next'
import {
  loadProfile,
  saveProfile,
  randomPick,
  PLAYER_COLORS,
  NAME_ADJECTIVES,
  NAME_ANIMALS
} from '@/utils/playerProfile'
import { useLobbySession } from './useLobbySession'
import LobbyChat from './LobbyChat.vue'
import LobbyPresence from './LobbyPresence.vue'
import LobbyRoomList from './LobbyRoomList.vue'
import type { GameType } from '@/types/lobby'
import type { LobbyRoom } from '@/types/lobby'
import { GAME_LABELS, GAME_TYPES } from './constants'

const GAME_COMPONENTS: Record<GameType, ReturnType<typeof defineAsyncComponent>> = {
  Pictionary: defineAsyncComponent(() => import('@/views/Games/Pictionary/Pictionary.vue')),
  SquaresMultiplayer: defineAsyncComponent(
    () => import('@/views/Games/SquaresMultiplayer/SquaresMultiplayer.vue')
  ),
  WordleMultiplayer: defineAsyncComponent(
    () => import('@/views/Games/WordleMultiplayer/WordleMultiplayer.vue')
  )
}

const route = useRoute()
const router = useRouter()

const stored = loadProfile()
const playerName = ref(stored?.name ?? `${randomPick(NAME_ADJECTIVES)} ${randomPick(NAME_ANIMALS)}`)
const playerColor = ref(stored?.color ?? randomPick(PLAYER_COLORS))

const { localPeerId, ownRoom, init, sendChat, createRoom, closeRoom, toggleRoomVisibility } =
  useLobbySession(playerName.value, playerColor.value)

const ownRoomId = computed(() => ownRoom.value?.id ?? null)
const activeGame = computed(() => route.query.game as GameType | undefined)
const activeComponent = computed(() =>
  activeGame.value ? GAME_COMPONENTS[activeGame.value] : null
)

onMounted(() => {
  saveProfile(playerName.value, playerColor.value)
  init()
})

const handleNameCommit = (): void => {
  saveProfile(playerName.value, playerColor.value)
}

const handleColorPick = (color: string): void => {
  playerColor.value = color
  saveProfile(playerName.value, playerColor.value)
}

const pickGame = (game: GameType): void => {
  const roomId = crypto.randomUUID()
  const room: LobbyRoom = {
    id: roomId,
    name: `${playerName.value}'s room`,
    game,
    hostId: localPeerId.value,
    hostName: playerName.value,
    players: [{ id: localPeerId.value, name: playerName.value, color: playerColor.value }],
    isHidden: false,
    createdAt: Date.now()
  }
  createRoom(room)
  router.replace({ query: { game, room: roomId } })
}

const handleJoin = (room: LobbyRoom): void => {
  router.replace({ query: { game: room.game, room: room.id } })
}

const handleToggle = (): void => {
  toggleRoomVisibility()
}

const handleLeave = (): void => {
  closeRoom()
  router.replace({ query: {} })
}
</script>

<template>
  <div class="lobby">
    <!-- Game area -->
    <main class="lobby__main">
      <div v-if="activeComponent" class="lobby__game-area">
        <button class="lobby__leave-btn" type="button" @click="handleLeave">← Lobby</button>
        <div class="lobby__game-embed">
          <component :is="activeComponent" />
        </div>
      </div>

      <div v-else class="lobby__picker">
        <p class="lobby__picker-label">Pick a game to create a room</p>
        <div class="lobby__picker-games">
          <button
            v-for="game in GAME_TYPES"
            :key="game"
            class="lobby__game-card"
            type="button"
            @click="pickGame(game)"
          >
            <span class="lobby__game-name">{{ GAME_LABELS[game] }}</span>
          </button>
        </div>
      </div>
    </main>

    <!-- Sidebar -->
    <aside class="lobby__sidebar">
      <!-- Profile -->
      <div class="lobby__profile">
        <input
          v-model="playerName"
          class="lobby__name-input"
          type="text"
          maxlength="20"
          placeholder="Your name"
          @change="handleNameCommit"
          @blur="handleNameCommit"
        />
        <div class="lobby__swatches">
          <button
            v-for="color in PLAYER_COLORS"
            :key="color"
            class="lobby__swatch"
            :class="{ 'lobby__swatch--active': playerColor === color }"
            :style="{ background: color }"
            type="button"
            @click="handleColorPick(color)"
          >
            <Check v-if="playerColor === color" class="lobby__swatch-check" />
          </button>
        </div>
      </div>

      <!-- Presence -->
      <LobbyPresence :local-peer-id="localPeerId" />

      <!-- Rooms -->
      <LobbyRoomList
        :local-peer-id="localPeerId"
        :own-room-id="ownRoomId"
        @join="handleJoin"
        @toggle="handleToggle"
      />

      <!-- Chat -->
      <div class="lobby__chat">
        <LobbyChat :local-peer-id="localPeerId" @send="sendChat" />
      </div>
    </aside>
  </div>
</template>

<style scoped>
.lobby {
  --lb-yellow: #ffd93d;
  --lb-pink: #ff6bcb;
  --lb-blue: #4ecdc4;
  --lb-orange: #ff8c42;

  padding-top: var(--nav-height);
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 1fr 280px;
  grid-template-areas: 'main sidebar';
  height: 100dvh;
  overflow: hidden;
  background: #fff7e6;
  font-family: 'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive, system-ui;
}

.lobby__main {
  grid-area: main;
  border-right: 3px solid #111;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Game picker */
.lobby__picker {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
}

.lobby__picker-label {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-muted-foreground);
}

.lobby__picker-games {
  display: flex;
  gap: var(--spacing-4);
  flex-wrap: wrap;
  justify-content: center;
}

.lobby__game-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-5, 1.5rem) var(--spacing-6, 2rem);
  border: 3px solid #111;
  border-radius: 1.25rem;
  background: var(--lb-yellow);
  box-shadow: 5px 5px 0 #111;
  cursor: pointer;
  transition: transform 0.1s ease;
  min-width: 9rem;
  touch-action: manipulation;
}

.lobby__game-card:nth-child(2) {
  background: var(--lb-blue);
}

.lobby__game-card:nth-child(3) {
  background: var(--lb-pink);
}

.lobby__game-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 7px 7px 0 #111;
}

.lobby__game-name {
  font-size: var(--font-size-md, 1rem);
  font-weight: 900;
  color: #111;
  letter-spacing: 0.02em;
}

/* Embedded game */
.lobby__game-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  --nav-height: 0px;
}

.lobby__leave-btn {
  flex-shrink: 0;
  align-self: flex-start;
  margin: var(--spacing-2) var(--spacing-3);
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid #111;
  border-radius: 999px;
  background: #fff7e6;
  color: #111;
  font-size: var(--font-size-xs);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 2px 2px 0 #111;
  transition: transform 0.1s ease;
}

.lobby__leave-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.lobby__game-embed {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

/* Sidebar */
.lobby__sidebar {
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fffbf0;
}

.lobby__profile {
  padding: var(--spacing-2) var(--spacing-3);
  border-bottom: 3px solid #111;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.lobby__name-input {
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid #111;
  border-radius: 999px;
  background: #fff;
  color: #111;
  font-size: var(--font-size-sm);
  font-weight: 700;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
}

.lobby__swatches {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.lobby__swatch {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid #111;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  box-shadow: 1px 1px 0 #111;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s ease;
}

.lobby__swatch:hover {
  transform: scale(1.15);
}

.lobby__swatch-check {
  width: 0.75rem;
  height: 0.75rem;
  color: #fff;
  stroke-width: 4;
}

.lobby__chat {
  flex: 1;
  min-height: 0;
  border-top: 3px solid #111;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (max-width: 720px) {
  .lobby {
    grid-template-columns: 1fr;
    grid-template-areas: 'main' 'sidebar';
    grid-template-rows: 1fr auto;
  }

  .lobby__main {
    border-right: none;
    border-bottom: 2px solid var(--color-border);
  }

  .lobby__sidebar {
    max-height: 50dvh;
  }

  .lobby__picker-games {
    gap: var(--spacing-3);
  }

  .lobby__game-card {
    padding: var(--spacing-3) var(--spacing-4);
    min-width: 7rem;
  }
}
</style>
