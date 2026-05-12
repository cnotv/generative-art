<script setup lang="ts">
import { ref, computed, onMounted, watch, defineAsyncComponent } from 'vue'
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
import { useSquaresMultiplayerStore } from '@/stores/squaresMultiplayer'
import { usePictionaryStore } from '@/stores/pictionary'
import { useWordleMultiplayerStore } from '@/stores/wordleMultiplayer'
import LobbyChat from './LobbyChat.vue'
import LobbyPresence from './LobbyPresence.vue'
import LobbyRoomList from './LobbyRoomList.vue'
import type { GameType, LobbyRoom } from '@/types/lobby'
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
const lobbyStore = useLobbyStore()
const squaresStore = useSquaresMultiplayerStore()
const pictionaryStore = usePictionaryStore()
const wordleStore = useWordleMultiplayerStore()

const stored = loadProfile()
const playerName = ref(stored?.name ?? `${randomPick(NAME_ADJECTIVES)} ${randomPick(NAME_ANIMALS)}`)
const playerColor = ref(stored?.color ?? randomPick(PLAYER_COLORS))

const {
  localPeerId,
  ownRoom,
  init,
  sendChat,
  updateProfile,
  createRoom,
  closeRoom,
  toggleRoomVisibility,
  updateRoomPlayers
} = useLobbySession(playerName.value, playerColor.value)

const ownRoomId = computed(() => ownRoom.value?.id ?? null)
const activeGame = computed(() => route.query.game as GameType | undefined)
const activeComponent = computed(() =>
  activeGame.value ? GAME_COMPONENTS[activeGame.value] : null
)
// Watch the active game's player list to keep the lobby room count current
const gamePlayerList = computed(() => {
  if (activeGame.value === 'Pictionary') return pictionaryStore.playerList
  if (activeGame.value === 'SquaresMultiplayer') return squaresStore.playerList
  if (activeGame.value === 'WordleMultiplayer') return wordleStore.playerList
  return []
})

watch(
  gamePlayerList,
  (players) => {
    if (!ownRoom.value) return
    updateRoomPlayers(players.map((p) => ({ id: p.id, name: p.name, color: p.color })))
  },
  { deep: true }
)

// Auto-close own lobby room when navigating away from a game
watch(activeGame, (game, previous) => {
  if (previous && !game) {
    closeRoom()
    const fresh = loadProfile()
    if (fresh) {
      playerName.value = fresh.name
      playerColor.value = fresh.color
      updateProfile(fresh.name, fresh.color)
    }
  }
})

onMounted(() => {
  saveProfile(playerName.value, playerColor.value)
  init()
})

const handleNameCommit = (): void => {
  saveProfile(playerName.value, playerColor.value)
  updateProfile(playerName.value, playerColor.value)
}

const handleColorPick = (color: string): void => {
  playerColor.value = color
  saveProfile(playerName.value, playerColor.value)
  updateProfile(playerName.value, playerColor.value)
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
  if (ownRoom.value) closeRoom()
  router.replace({ query: { game: room.game, room: room.id } })
}
</script>

<template>
  <div class="lobby" :class="{ 'lobby--in-game': !!activeComponent }">
    <!-- Main content area -->
    <main class="lobby__main">
      <div v-if="activeComponent" class="lobby__game-embed">
        <component :is="activeComponent" />
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

    <!-- Sidebar — hidden when a game is active -->
    <aside v-if="!activeComponent" class="lobby__sidebar">
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
        @toggle="toggleRoomVisibility"
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

.lobby--in-game {
  grid-template-columns: 1fr;
  grid-template-areas: 'main';
}

.lobby__main {
  grid-area: main;
  border-right: 3px solid #111;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.lobby--in-game .lobby__main {
  border-right: none;
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
.lobby__game-embed {
  flex: 1;
  overflow: auto;
  min-height: 0;
  --nav-height: 0px;
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

  .lobby--in-game {
    grid-template-rows: auto 1fr;
  }

  .lobby__main {
    border-right: none;
    border-bottom: 2px solid #111;
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
