<script setup lang="ts">
import { ref, computed, onMounted, watch, provide, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { LobbyUINameInput, LobbyUIColorSwatches } from '@/components/LobbyUI'
import { useMenuNavigation } from '@/composables/useMenuNavigation'
import '@/assets/styles/lobby-ui.scss'
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
import { useMinigolfStore } from '@/stores/minigolf'
import { useBubbleShooterStore } from '@/stores/bubbleShooter'
import { useRhythmGameStore } from '@/stores/rhythmGame'
import { useMarbleMadnessStore } from '@/stores/marbleMadness'
import LobbyChat from './LobbyChat.vue'
import LobbyPresence from './LobbyPresence.vue'
import LobbyRoomList from './LobbyRoomList.vue'
import { useLobbyStore } from '@/stores/lobby'
import type { GameType, LobbyRoom } from '@/types/lobby'
import { GAME_LABELS, GAME_TYPES, GAME_COMPONENTS } from './constants'

const route = useRoute()
const router = useRouter()

const gameStores: Record<GameType, { playerList: { id: string; name: string; color: string }[] }> =
  {
    Pictionary: usePictionaryStore(),
    SquaresMultiplayer: useSquaresMultiplayerStore(),
    WordleMultiplayer: useWordleMultiplayerStore(),
    Minigolf: useMinigolfStore(),
    BubbleShooter: useBubbleShooterStore(),
    RhythmGame: useRhythmGameStore(),
    MarbleMadness: useMarbleMadnessStore()
  }

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

provide('setRoomHidden', (hidden: boolean) => {
  if (ownRoom.value && ownRoom.value.isHidden !== hidden) {
    toggleRoomVisibility()
  }
})
const activeGame = computed(() => route.query.game as GameType | undefined)
const activeComponent = computed(() =>
  activeGame.value ? GAME_COMPONENTS[activeGame.value] : null
)
const gamePlayerList = computed(() =>
  activeGame.value ? gameStores[activeGame.value].playerList : []
)

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

const lobbyStore = useLobbyStore()
const { players: lobbyPlayers, rooms: lobbyRooms } = storeToRefs(lobbyStore)
const onlineCount = computed(() => Object.keys(lobbyPlayers.value).length)
const roomCount = computed(() => Object.keys(lobbyRooms.value).length)

const profileOpen = ref(true)
const presenceOpen = ref(true)
const roomsOpen = ref(true)

const lobbyRoot = ref<HTMLElement | null>(null)
const focusRow = ref(0)
const focusCol = ref(0)

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]'

const queryRows = (): HTMLElement[] => {
  if (!lobbyRoot.value) return []
  return [...lobbyRoot.value.querySelectorAll<HTMLElement>('[data-nav-row]')].filter(
    (row) => row.querySelectorAll(FOCUSABLE_SELECTOR).length > 0
  )
}

const queryFocusables = (row: HTMLElement): HTMLElement[] => [
  ...row.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
]

const applyFocus = (): void => {
  const rows = queryRows()
  const row = rows[focusRow.value]
  if (!row) return
  const items = queryFocusables(row)
  const target = items[Math.min(focusCol.value, items.length - 1)]
  target?.focus()
}

const isTextInput = (element: Element | null): boolean =>
  element instanceof HTMLInputElement &&
  new Set(['text', 'number', 'email', 'password']).has(element.type)

const handleNavUp = (rows: HTMLElement[]): void => {
  focusRow.value = Math.max(0, focusRow.value - 1)
  focusCol.value = 0
  applyFocus()
  rows.length // suppress unused-param warning
}

const handleNavDown = (rows: HTMLElement[]): void => {
  focusRow.value = Math.min(rows.length - 1, focusRow.value + 1)
  focusCol.value = 0
  applyFocus()
}

const handleNavLeft = (rows: HTMLElement[]): void => {
  if (!rows[focusRow.value]) return
  focusCol.value = Math.max(0, focusCol.value - 1)
  applyFocus()
}

const handleNavRight = (rows: HTMLElement[]): void => {
  const row = rows[focusRow.value]
  if (!row) return
  focusCol.value = Math.min(queryFocusables(row).length - 1, focusCol.value + 1)
  applyFocus()
}

useMenuNavigation((action) => {
  const rows = queryRows()
  if (!rows.length) return
  const active = document.activeElement
  if (isTextInput(active) && (action === 'left' || action === 'right')) return

  const handlers: Partial<Record<typeof action, () => void>> = {
    up: () => handleNavUp(rows),
    down: () => handleNavDown(rows),
    left: () => handleNavLeft(rows),
    right: () => handleNavRight(rows),
    activate: () => {
      if (active instanceof HTMLElement && !isTextInput(active)) active.click()
    },
    cancel: () => (active as HTMLElement | null)?.blur?.()
  }
  handlers[action]?.()
})

onMounted(async () => {
  await nextTick()
  applyFocus()
})
</script>

<template>
  <div ref="lobbyRoot" class="lobby" :class="{ 'lobby--in-game': !!activeComponent }">
    <!-- Main content area -->
    <main class="lobby__main">
      <div v-if="activeComponent" class="lobby__game-embed">
        <component :is="activeComponent" />
      </div>

      <div v-else class="lobby__picker">
        <p class="lobby__picker-label">Pick a game to create a room</p>
        <div class="lobby__picker-games" data-nav-row>
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
      <div class="lobby__section" :class="{ 'lobby__section--collapsed': !profileOpen }">
        <button
          class="lobby__section-toggle"
          data-nav-row
          type="button"
          @click="profileOpen = !profileOpen"
        >
          <span class="lobby__section-label">Profile</span>
          <span
            class="lobby__section-chevron"
            :class="{ 'lobby__section-chevron--open': profileOpen }"
            >›</span
          >
        </button>
        <div v-show="profileOpen" class="lobby__profile">
          <div data-nav-row>
            <LobbyUINameInput
              :model-value="playerName"
              :maxlength="20"
              placeholder="Your name"
              @update:model-value="playerName = $event"
              @change="handleNameCommit"
              @blur="handleNameCommit"
            />
          </div>
          <div data-nav-row>
            <LobbyUIColorSwatches
              :model-value="playerColor"
              :colors="PLAYER_COLORS"
              @update:model-value="handleColorPick"
            />
          </div>
        </div>
      </div>

      <!-- Presence -->
      <div class="lobby__section" :class="{ 'lobby__section--collapsed': !presenceOpen }">
        <button
          class="lobby__section-toggle"
          data-nav-row
          type="button"
          @click="presenceOpen = !presenceOpen"
        >
          <span class="lobby__section-label">Online ({{ onlineCount }})</span>
          <span
            class="lobby__section-chevron"
            :class="{ 'lobby__section-chevron--open': presenceOpen }"
            >›</span
          >
        </button>
        <div v-show="presenceOpen">
          <LobbyPresence :local-peer-id="localPeerId" />
        </div>
      </div>

      <!-- Rooms -->
      <div class="lobby__section" :class="{ 'lobby__section--collapsed': !roomsOpen }">
        <button
          class="lobby__section-toggle"
          data-nav-row
          type="button"
          @click="roomsOpen = !roomsOpen"
        >
          <span class="lobby__section-label">Rooms ({{ roomCount }})</span>
          <span
            class="lobby__section-chevron"
            :class="{ 'lobby__section-chevron--open': roomsOpen }"
            >›</span
          >
        </button>
        <div v-show="roomsOpen">
          <LobbyRoomList
            :local-peer-id="localPeerId"
            :own-room-id="ownRoomId"
            @join="handleJoin"
            @toggle="toggleRoomVisibility"
          />
        </div>
      </div>

      <!-- Chat -->
      <div class="lobby__chat">
        <LobbyChat :local-peer-id="localPeerId" @send="sendChat" />
      </div>
    </aside>
  </div>
</template>

<style scoped>
.lobby {
  display: grid;
  grid-template-columns: 1fr 280px;
  grid-template-areas: 'main sidebar';
  height: 100dvh;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--lb-bg);
  font-family: var(--lui-font);
}

.lobby--in-game {
  grid-template-columns: 1fr;
  grid-template-areas: 'main';
}

.lobby__main {
  grid-area: main;
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
  padding-top: var(--nav-height);
}

.lobby__picker-label {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 700;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
  border: 3px solid var(--lui-stroke);
  border-radius: 1.25rem;
  background: transparent;
  box-shadow: var(--lui-border-shadow);
  cursor: pointer;
  transition: transform 0.1s ease;
  min-width: 9rem;
  touch-action: manipulation;
}

.lobby__game-card:hover,
.lobby__game-card:focus,
.lobby__game-card:focus-visible {
  outline: none;
  transform: translate(-2px, -2px);
  border-color: var(--lui-focus-color);
  color: var(--lui-focus-color);
}

.lobby__game-name {
  font-family: var(--lui-font);
  font-size: var(--lui-text-medium);
  font-weight: 900;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

/* Picker and embedded game slide up on mount */
.lobby__picker,
.lobby__game-embed {
  animation: slide-up 0.28s ease both;
}

/* Embedded game */
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
  background: transparent;
  padding-top: var(--nav-height);
  border-left: 2px solid var(--lui-stroke-faint);
  animation: slide-from-right 0.32s ease both;
}

.lobby__section {
  border-bottom: 2px solid var(--lui-stroke-faint);
}

.lobby__section-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-2) var(--spacing-3);
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--lui-font);
  gap: var(--spacing-2);
}

.lobby__section-label {
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 800;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.lobby__section-chevron {
  font-size: var(--lui-text-small);
  color: var(--lui-text-color);
  opacity: 0.6;
  transition: transform 0.15s ease;
  transform: rotate(90deg);
  display: inline-block;
}

.lobby__section-chevron--open {
  transform: rotate(270deg);
}

.lobby__profile {
  padding: 0 var(--spacing-3) var(--spacing-2);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.lobby__chat {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (width <= 720px) {
  .lobby {
    grid-template-columns: 1fr;
    grid-template-areas: 'main' 'sidebar';
    grid-template-rows: 1fr auto;
  }

  .lobby--in-game {
    grid-template-rows: auto 1fr;
  }

  .lobby__sidebar {
    max-height: 50dvh;
    padding-top: 0;
    border-left: none;
    border-top: 2px solid var(--lui-stroke-faint);
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
