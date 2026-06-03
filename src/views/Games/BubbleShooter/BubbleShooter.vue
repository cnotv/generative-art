<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useBubbleShooterStore } from '@/stores/bubbleShooter'
import { useBubbleShooterSession } from './useBubbleShooterSession'
import { useBubbleShooterGame } from './useBubbleShooterGame'
import { useRoomId } from '@/composables/useRoomId'
import { useMultiplayerLobbyHandlers } from '@/composables/useMultiplayerLobbyHandlers'
import {
  loadProfile,
  randomPick,
  NAME_ADJECTIVES,
  NAME_ANIMALS,
  PLAYER_COLORS,
  buildRandomGradient
} from '@/utils/playerProfile'
import MultiplayerSidebar, { type MultiplayerPlayer } from '@/components/MultiplayerSidebar.vue'
import GameTabBar from '@/components/GameTabBar.vue'
import GameHeader from '@/components/GameHeader.vue'
import LobbyLayout from '@/layout/LobbyLayout.vue'
import BubbleShooterLobby from './BubbleShooterLobby.vue'
import BubbleShooterGame from './BubbleShooterGame.vue'
import BubbleShooterSummary from './BubbleShooterSummary.vue'

const store = useBubbleShooterStore()
const { phase, playerList, messages, winnerId, hostId, colorCount, speed } = storeToRefs(store)

const storedProfile = loadProfile()
const playerName = ref(
  storedProfile?.name ?? `${randomPick(NAME_ADJECTIVES)}${randomPick(NAME_ANIMALS)}`
)
const playerColor = ref(storedProfile?.color ?? randomPick(PLAYER_COLORS))
const backgroundStyle = { backgroundImage: buildRandomGradient() }

const { roomId, resolvedRoomId } = useRoomId()

// ---- game ref (canvas exposure) ----
const gameReference = ref<InstanceType<typeof BubbleShooterGame> | null>(null)
const canvas = computed(() => gameReference.value?.canvas ?? null)

// ---- session (P2P) ----
const session = useBubbleShooterSession(
  { name: playerName.value, color: playerColor.value, roomId: resolvedRoomId },
  (count) => game.receiveGarbage(count)
)
const { isHost, localPeerId } = session

const solo = computed(() => store.solo)

// ---- game (Three.js) ----
const game = useBubbleShooterGame({
  canvas,
  isSolo: solo,
  colorCount,
  speed,
  onScore: (points) => {
    store.addScore(localPeerId.value, points)
    if (!store.solo) session.broadcastScore(store.players[localPeerId.value]?.score ?? 0)
  },
  onGarbageSent: (count) => session.broadcastGarbage(count),
  onGameOver: () => {
    if (store.solo) {
      store.phase = 'summary'
    } else {
      session.broadcastGameOver()
    }
  }
})

// ---- sidebar / tab bar ----
const showSidebar = ref(false)
const lastReadCount = ref(0)
const unreadCount = computed(() => Math.max(0, messages.value.length - lastReadCount.value))

watch(showSidebar, (open) => {
  if (open) lastReadCount.value = messages.value.length
})
watch(messages, () => {
  if (showSidebar.value) lastReadCount.value = messages.value.length
})

const sidebarPlayers = computed((): MultiplayerPlayer[] =>
  playerList.value.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    score: p.score,
    isHost: p.id === hostId.value
  }))
)

const opponentPlayer = computed(() => playerList.value.find((p) => p.id !== localPeerId.value))

// ---- lifecycle ----
watch(phase, async (newPhase) => {
  if (newPhase === 'playing') {
    await nextTick()
    game.init()
  }
})

const {
  handleNameChange,
  handleColorChange,
  handleMatchFound,
  handleLeaveRoom: leaveRoom
} = useMultiplayerLobbyHandlers(playerName, playerColor, roomId, session)

const handleLeaveRoom = (): void => {
  store.solo = false
  leaveRoom()
}

const handleStartGame = (): void => {
  const isSolo = playerList.value.length <= 1
  if (isSolo) {
    store.solo = true
    store.upsertPlayer({
      id: localPeerId.value || 'solo',
      name: playerName.value,
      color: playerColor.value,
      score: 0
    })
    store.phase = 'playing'
  } else {
    session.startGame()
  }
}

const handleRestart = (): void => {
  if (store.solo) {
    store.phase = 'lobby'
    store.solo = false
  } else {
    session.restartGame()
  }
}

onMounted(() => {
  session.init()
})
</script>

<template>
  <LobbyLayout
    ref="layoutReference"
    class="bs"
    :phase="phase"
    :show-sidebar="showSidebar"
    :main-placement="phase === 'playing' ? 'fill' : 'center'"
    :style="backgroundStyle"
    @leave-room="handleLeaveRoom"
  >
    <template #header>
      <GameHeader @leave-room="requestLeave" />
    </template>

    <template #rules>
      <ul>
        <li>Aim with your mouse or finger and click/tap to shoot</li>
        <li>Match <strong>3 or more</strong> bubbles of the same color to pop them</li>
        <li>Bubbles no longer attached to the ceiling also fall</li>
        <li>In multiplayer — clearing rows sends <strong>garbage</strong> to your opponent</li>
        <li>Game ends when bubbles reach the fire line</li>
      </ul>
    </template>

    <BubbleShooterLobby
      v-if="phase === 'lobby'"
      :player-name="playerName"
      :player-color="playerColor"
      :is-host="isHost"
      :player-list="playerList"
      :room-id="roomId"
      :color-count="colorCount"
      :speed="speed"
      @update:player-name="playerName = $event"
      @update:player-color="handleColorChange"
      @update:color-count="colorCount = $event"
      @update:speed="speed = $event"
      @name-change="handleNameChange"
      @start-game="handleStartGame"
      @match-found="handleMatchFound"
      @leave-room="handleLeaveRoom"
    />

    <BubbleShooterGame
      v-else-if="phase === 'playing'"
      ref="gameReference"
      :score="game.score.value"
      :shot-count="game.shotCount.value"
      :current-color="game.currentColor.value"
      :next-color="game.nextColor.value"
      :opponent-score="opponentPlayer?.score"
      :opponent-name="opponentPlayer?.name"
    />

    <BubbleShooterSummary
      v-else
      :player-list="playerList"
      :winner-id="winnerId"
      :local-peer-id="localPeerId"
      :is-host="isHost || store.solo"
      @restart="handleRestart"
      @leave-room="handleLeaveRoom"
    />

    <template v-if="!store.solo" #sidebar>
      <MultiplayerSidebar
        :players="sidebarPlayers"
        :local-peer-id="localPeerId"
        :messages="messages"
        chat-placeholder="Say something…"
        @send="session.broadcastChat($event)"
      />
    </template>

    <template v-if="!store.solo" #tabbar>
      <GameTabBar v-model:show-sidebar="showSidebar" :unread-count="unreadCount" />
    </template>
  </LobbyLayout>
</template>

<style scoped>
.bs {
  --bs-accent: #4ecdc4;

  background: var(--lb-bg);
  font-family: 'Segoe UI', system-ui, sans-serif;
}
</style>
