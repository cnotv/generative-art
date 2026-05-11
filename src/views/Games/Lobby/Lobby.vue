<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
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
import LobbyCreateRoom from './LobbyCreateRoom.vue'
import type { GameType } from '@/types/lobby'
import type { LobbyRoom } from '@/types/lobby'

const router = useRouter()

const stored = loadProfile()
const playerName = ref(stored?.name ?? `${randomPick(NAME_ADJECTIVES)} ${randomPick(NAME_ANIMALS)}`)
const playerColor = ref(stored?.color ?? randomPick(PLAYER_COLORS))

const { localPeerId, ownRoom, init, sendChat, createRoom, closeRoom } = useLobbySession(
  playerName.value,
  playerColor.value
)

const showCreate = ref(false)

const ownRoomId = computed(() => ownRoom.value?.id ?? null)

onMounted(() => {
  saveProfile(playerName.value, playerColor.value)
  init()
})

const handleCreate = (name: string, game: GameType, isHidden: boolean): void => {
  const room: LobbyRoom = {
    id: crypto.randomUUID(),
    name,
    game,
    hostId: localPeerId.value,
    hostName: playerName.value,
    players: [{ id: localPeerId.value, name: playerName.value, color: playerColor.value }],
    isHidden,
    createdAt: Date.now()
  }
  createRoom(room)
  showCreate.value = false
}

const handleJoin = (room: LobbyRoom): void => {
  router.push({ path: `/games/${room.game}`, query: { room: room.id } })
}

const handleClose = (): void => {
  closeRoom()
}
</script>

<template>
  <div class="lobby">
    <header class="lobby__header">
      <h1 class="lobby__title">Lobby</h1>
      <button
        v-if="!ownRoom"
        class="lobby__create-btn"
        type="button"
        @click="showCreate = !showCreate"
      >
        + Create room
      </button>
    </header>

    <div class="lobby__body">
      <section class="lobby__chat">
        <LobbyChat :local-peer-id="localPeerId" @send="sendChat" />
      </section>

      <aside class="lobby__sidebar">
        <LobbyPresence :local-peer-id="localPeerId" />
        <LobbyRoomList
          :local-peer-id="localPeerId"
          :own-room-id="ownRoomId"
          @join="handleJoin"
          @close="handleClose"
        />
        <LobbyCreateRoom v-if="showCreate" @create="handleCreate" @cancel="showCreate = false" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  padding-top: var(--nav-height);
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
}

.lobby__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-3) var(--spacing-4);
  border-bottom: 2px solid var(--color-border);
  flex-shrink: 0;
}

.lobby__title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 800;
  color: #111;
}

.lobby__create-btn {
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid #111;
  border-radius: 999px;
  background: #111;
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 2px 2px 0 #444;
  transition: transform 0.1s ease;
}

.lobby__create-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #444;
}

.lobby__body {
  display: grid;
  grid-template-columns: 1fr 280px;
  grid-template-areas: 'chat sidebar';
  flex: 1;
  min-height: 0;
}

.lobby__chat {
  grid-area: chat;
  border-right: 2px solid var(--color-border);
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.lobby__sidebar {
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (max-width: 640px) {
  .lobby__body {
    grid-template-columns: 1fr;
    grid-template-areas: 'chat' 'sidebar';
    grid-template-rows: 1fr auto;
  }

  .lobby__chat {
    border-right: none;
    border-bottom: 2px solid var(--color-border);
  }

  .lobby__sidebar {
    max-height: 40dvh;
  }
}
</style>
