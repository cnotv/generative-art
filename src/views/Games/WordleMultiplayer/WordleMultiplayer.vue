<script setup lang="ts">
import { ref, computed, onUnmounted, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useWordleMultiplayerStore } from '@/stores/wordleMultiplayer'
import { useWordleMultiplayerSession } from './useWordleMultiplayerSession'
import { INTERMISSION_MS } from './constants'
import {
  buildRandomGradient,
  randomPick,
  loadProfile,
  saveProfile,
  NAME_ADJECTIVES,
  NAME_ANIMALS,
  PLAYER_COLORS
} from '@/utils/playerProfile'
import GameHeader from '@/components/GameHeader.vue'
import LobbyLayout from '@/layout/LobbyLayout.vue'
import WordleMultiplayerLobby from './WordleMultiplayerLobby.vue'
import WordleMultiplayerGame from './WordleMultiplayerGame.vue'
import WordleMultiplayerIntermission from './WordleMultiplayerIntermission.vue'
import WordleMultiplayerSummary from './WordleMultiplayerSummary.vue'
import MultiplayerSidebar, { type MultiplayerPlayer } from '@/components/MultiplayerSidebar.vue'
import GameTabBar from '@/components/GameTabBar.vue'

const route = useRoute()
const router = useRouter()
const store = useWordleMultiplayerStore()
const {
  phase,
  playerList,
  players,
  messages,
  winnerId,
  totalRounds,
  roundDuration,
  difficulty,
  intermissionEndsAt,
  round,
  solvedPlayers,
  playerGuesses,
  hostId
} = storeToRefs(store)

const storedProfile = loadProfile()
const playerName = ref(
  storedProfile?.name ?? `${randomPick(NAME_ADJECTIVES)}${randomPick(NAME_ANIMALS)}`
)
const playerColor = ref(storedProfile?.color ?? randomPick(PLAYER_COLORS))
const backgroundStyle = { backgroundImage: buildRandomGradient() }
const resolvedRoomId = ((): string => {
  const existing = route.query.room as string | undefined
  if (existing) return existing
  const next = crypto.randomUUID()
  router.replace({ query: { ...route.query, room: next } })
  return next
})()

const roomId = ref(resolvedRoomId)

const session = useWordleMultiplayerSession({
  name: playerName.value,
  color: playerColor.value,
  roomId: resolvedRoomId
})

const { isHost, localPeerId } = session
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
    isHost: p.id === hostId.value,
    isSolved: !!solvedPlayers.value[p.id]
  }))
)

const timeLeft = ref<number | null>(null)
const intermissionLeft = ref(0)

let roundTimer: ReturnType<typeof setInterval> | null = null
let intermissionTimer: ReturnType<typeof setInterval> | null = null

const startRoundTimer = (): void => {
  if (roundTimer) clearInterval(roundTimer)
  if (!round.value.endsAt) {
    timeLeft.value = null
    return
  }
  roundTimer = setInterval(() => {
    const endsAt = round.value.endsAt
    if (!endsAt) {
      timeLeft.value = null
      return
    }
    const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
    timeLeft.value = remaining
    if (remaining === 0) {
      if (roundTimer) clearInterval(roundTimer)
      if (isHost.value) session.endRound()
    }
  }, 250)
}

const startIntermissionTimer = (): void => {
  if (intermissionTimer) clearInterval(intermissionTimer)
  intermissionTimer = setInterval(() => {
    const endsAt = intermissionEndsAt.value
    if (!endsAt) return
    intermissionLeft.value = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  }, 250)
}

watch(phase, (newPhase) => {
  if (newPhase === 'playing') {
    timeLeft.value = round.value.endsAt ? roundDuration.value : null
    startRoundTimer()
  } else if (newPhase === 'intermission') {
    if (roundTimer) clearInterval(roundTimer)
    intermissionLeft.value = Math.ceil(INTERMISSION_MS / 1000)
    startIntermissionTimer()
  } else {
    if (roundTimer) clearInterval(roundTimer)
    if (intermissionTimer) clearInterval(intermissionTimer)
  }
})

const shareableLink = computed(() => {
  const url = new URL(window.location.href)
  url.searchParams.set('room', roomId.value)
  return url.toString()
})

const copyLink = async (): Promise<void> => {
  await navigator.clipboard.writeText(shareableLink.value)
}

const handleMatchFound = (gameRoomId: string): void => {
  roomId.value = gameRoomId
  router.replace({ query: { room: gameRoomId } })
  session.reconnect(gameRoomId)
}

const handleLeaveRoom = (): void => {
  const freshId = crypto.randomUUID()
  roomId.value = freshId
  router.replace({ query: { room: freshId } })
  session.reconnect(freshId)
}

const handleNameChange = (): void => {
  const trimmed = playerName.value.trim()
  if (!trimmed) return
  session.updateProfile(trimmed, playerColor.value)
  saveProfile(trimmed, playerColor.value)
}

const handleColorChange = (color: string): void => {
  playerColor.value = color
  session.updateProfile(playerName.value.trim() || playerName.value, color)
  saveProfile(playerName.value.trim() || playerName.value, color)
}

const myGuesses = computed(() => playerGuesses.value[localPeerId.value] ?? [])

onMounted(() => {
  store.reset()
  session.init()
})
</script>

<template>
  <LobbyLayout class="wl" :phase="phase" :show-sidebar="showSidebar" :style="backgroundStyle">
    <template #header>
      <GameHeader :room-id="roomId" @leave-room="handleLeaveRoom" @copy-link="copyLink" />
    </template>

    <template #rules>
      <ul>
        <li>Guess the secret word — all players guess simultaneously</li>
        <li>Green = correct letter and position · Yellow = letter in word but wrong position</li>
        <li>Fewer attempts and faster guesses earn more points</li>
        <li>First to solve gets a bonus</li>
        <li>Round ends when everyone finishes or time runs out</li>
      </ul>
    </template>

    <WordleMultiplayerLobby
      v-if="phase === 'lobby'"
      :player-name="playerName"
      :player-color="playerColor"
      :is-host="isHost"
      :player-list="playerList"
      :room-id="roomId"
      :difficulty="difficulty"
      :total-rounds="totalRounds"
      :round-duration="roundDuration"
      @update:player-name="playerName = $event"
      @update:player-color="handleColorChange"
      @update:difficulty="difficulty = $event"
      @update:total-rounds="totalRounds = $event"
      @update:round-duration="roundDuration = $event"
      @name-change="handleNameChange"
      @start-game="session.startRound()"
      @match-found="handleMatchFound"
      @leave-room="handleLeaveRoom"
    />

    <WordleMultiplayerGame
      v-else-if="phase === 'playing'"
      :word="round.word"
      :max-attempts="round.maxAttempts"
      :my-guesses="myGuesses"
      :solved-players="solvedPlayers"
      :local-peer-id="localPeerId"
      :round-number="round.number"
      :total-rounds="totalRounds"
      :time-left="timeLeft"
      @submit-guess="session.submitGuess($event)"
    />

    <WordleMultiplayerIntermission
      v-else-if="phase === 'intermission'"
      :round-number="round.number"
      :total-rounds="totalRounds"
      :word="round.word"
      :player-guesses="playerGuesses"
      :solved-players="solvedPlayers"
      :intermission-left="intermissionLeft"
      :player-list="playerList"
    />

    <WordleMultiplayerSummary
      v-else
      :player-list="playerList"
      :winner-id="winnerId"
      :is-host="isHost"
      @restart="session.restartGame()"
    />

    <template #sidebar>
      <MultiplayerSidebar
        :players="sidebarPlayers"
        :local-peer-id="localPeerId"
        :messages="messages"
        chat-placeholder="Say something…"
        @send="session.broadcastChat($event)"
      />
    </template>

    <template #tabbar>
      <GameTabBar v-model:show-sidebar="showSidebar" :unread-count="unreadCount" />
    </template>
  </LobbyLayout>
</template>

<style scoped>
.wl {
  --wl-green: #6aaa64;
  --game-accent: var(--wl-green);
  --wl-yellow: #c9b458;

  background: var(--wl-bg);
  font-family: 'Segoe UI', system-ui, sans-serif;
}
</style>
