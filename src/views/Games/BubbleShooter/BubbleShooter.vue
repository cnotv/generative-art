<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useBubbleShooterStore } from '@/stores/bubbleShooter'
import { useBubbleShooterSession } from './useBubbleShooterSession'
import { useBubbleShooterGame, setOnPlayAgainPressed } from './useBubbleShooterGame'
import { SCORE_POPUP_DURATION_MS, WATER_RISE_DURATION_MS } from './config'
import type { ScorePopup, ScorePopupItem } from './types'
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
import '@/assets/styles/lobby-ui.scss'
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

// ---- score popups ----
const scorePopups = ref<ScorePopupItem[]>([])
let nextScorePopupId = 0

const handleScore = (popup: ScorePopup): void => {
  const playerId = localPeerId.value || 'solo'
  store.addScore(playerId, popup.points)
  if (!store.solo) session.broadcastScore(store.players[playerId]?.score ?? 0)
  const id = nextScorePopupId++
  scorePopups.value = [...scorePopups.value, { ...popup, id }]
  setTimeout(() => {
    scorePopups.value = scorePopups.value.filter((item) => item.id !== id)
  }, SCORE_POPUP_DURATION_MS)
}

// ---- game (Three.js) ----
const game = useBubbleShooterGame({
  canvas,
  isSolo: solo,
  colorCount,
  speed,
  onScore: handleScore,
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
const isRestarting = ref(false)

watch(phase, async (newPhase) => {
  if (newPhase === 'playing') {
    await nextTick()
    game.init()
    isRestarting.value = false
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
  isRestarting.value = true
  scorePopups.value = []
  if (store.solo) {
    const player = store.players[localPeerId.value || 'solo']
    if (player) store.upsertPlayer({ ...player, score: 0 })
    store.phase = 'playing'
  } else {
    session.restartGame()
  }
}

onMounted(() => {
  store.reset()
  session.init()
  setOnPlayAgainPressed(() => {
    if (isHost.value || store.solo) handleRestart()
  })
})

onUnmounted(() => {
  setOnPlayAgainPressed(null)
})
</script>

<template>
  <LobbyLayout
    class="bs"
    :phase="phase"
    :show-sidebar="showSidebar"
    :sidebar-visible="!store.solo"
    :main-placement="phase === 'lobby' ? 'center' : 'fill'"
    :style="backgroundStyle"
    @leave-room="handleLeaveRoom"
  >
    <template #header>
      <GameHeader />
    </template>

    <template #rules>
      <ul>
        <li>Aim with your mouse or finger and click/tap to shoot</li>
        <li>Gamepad: aim with the left stick or D-pad, fire with the cross button</li>
        <li>Match <strong>3 or more</strong> bubbles of the same color to pop them</li>
        <li>Each popped bubble scores <strong>10 points</strong></li>
        <li>
          Bubbles no longer attached to the ceiling also fall, each adding a
          <strong>+5 combo bonus</strong>
        </li>
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

    <Transition v-else name="bs-phase-fade" appear>
      <div class="bs-game-wrapper">
        <BubbleShooterGame
          ref="gameReference"
          :score="game.score.value"
          :shot-count="game.shotCount.value"
          :high-score="game.highScore.value"
          :is-game-over="game.isGameOver.value"
          :opponent-score="opponentPlayer?.score"
          :opponent-name="opponentPlayer?.name"
          :score-popups="scorePopups"
        />
        <Transition name="bs-summary-fade" :css="!isRestarting" appear>
          <BubbleShooterSummary
            v-if="phase === 'summary'"
            :player-list="playerList"
            :winner-id="winnerId"
            :local-peer-id="localPeerId"
            :is-host="isHost || store.solo"
            :high-score="game.highScore.value"
            :style="{ '--bs-summary-fade-duration': `${WATER_RISE_DURATION_MS}ms` }"
            @restart="handleRestart"
          />
        </Transition>
      </div>
    </Transition>

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
  font-family: var(--lui-font);
}

.bs-game-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.bs-phase-fade-enter-active,
.bs-phase-fade-leave-active {
  transition: opacity var(--transition-game-phase) ease;
}

.bs-phase-fade-enter-from,
.bs-phase-fade-leave-to {
  opacity: 0;
}

.bs-summary-fade-enter-active {
  transition: opacity var(--bs-summary-fade-duration) ease-out;
}

.bs-summary-fade-enter-from {
  opacity: 0;
}
</style>
