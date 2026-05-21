<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useMinigolfStore } from '@/stores/minigolf'
import { useMinigolfSession } from './useMinigolfSession'
import { useMinigolfGame } from './useMinigolfGame'
import { HOLES } from './config'
import {
  loadProfile,
  saveProfile,
  randomPick,
  NAME_ADJECTIVES,
  NAME_ANIMALS,
  PLAYER_COLORS,
  buildRandomGradient
} from '@/utils/playerProfile'
import GameHeader from '@/components/GameHeader.vue'
import LobbyLayout from '@/layout/LobbyLayout.vue'
import MinigolfLobby from './MinigolfLobby.vue'
import MinigolfGame from './MinigolfGame.vue'
import MinigolfSummary from './MinigolfSummary.vue'
import MultiplayerSidebar, { type MultiplayerPlayer } from '@/components/MultiplayerSidebar.vue'
import GameTabBar from '@/components/GameTabBar.vue'

const route = useRoute()
const router = useRouter()
const store = useMinigolfStore()
const { phase, playerList, holeCount, selectedHoles, currentHole, messages, hostId } =
  storeToRefs(store)

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

const session = useMinigolfSession({
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

const activeHoles = computed(() =>
  selectedHoles.value.length > 0
    ? selectedHoles.value.map((i) => HOLES[i]).filter(Boolean)
    : HOLES.slice(0, holeCount.value)
)

const gameReference = ref<InstanceType<typeof MinigolfGame> | null>(null)
const canvas = computed(() => gameReference.value?.canvas ?? null)

const { message, waiting, aimPower, isAiming, localStrokes, startGame, cleanup } = useMinigolfGame(
  canvas,
  session,
  activeHoles
)

const sidebarPlayers = computed((): MultiplayerPlayer[] =>
  playerList.value.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    score: p.scores?.reduce((a, b) => a + b, 0) ?? 0,
    isHost: p.id === hostId.value
  }))
)

const allPlayersScored = computed(() => {
  const holeIndex = currentHole.value
  return (
    playerList.value.length > 0 && playerList.value.every((p) => (p.scores[holeIndex] ?? 0) > 0)
  )
})

watch(phase, async (newPhase) => {
  if (newPhase === 'playing') {
    await nextTick()
    startGame()
  }
})

watch(allPlayersScored, (allDone) => {
  if (!allDone || !isHost.value || phase.value !== 'playing') return
  setTimeout(() => {
    const nextHole = currentHole.value + 1
    if (nextHole >= activeHoles.value.length) {
      store.phase = 'summary'
      session.broadcastAdvanceHole(-1)
    } else {
      store.currentHole = nextHole
      session.broadcastAdvanceHole(nextHole)
    }
  }, 1500)
})

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

const handleSelectedHolesChange = (indices: number[]): void => {
  session.broadcastConfig(indices.length, indices)
}

const handleStartGame = (): void => {
  session.broadcastStart()
}

const handlePlayAgain = (): void => {
  store.phase = 'lobby'
  store.currentHole = 0
  waiting.value = false
  playerList.value.map((p) => ({ ...p, scores: [] })).forEach((p) => store.upsertPlayer(p))
  cleanup()
}

const copyLink = async (): Promise<void> => {
  const url = new URL(window.location.href)
  url.searchParams.set('room', roomId.value)
  await navigator.clipboard.writeText(url.toString())
}

onMounted(() => session.init())
onUnmounted(() => cleanup())
</script>

<template>
  <LobbyLayout class="mg" :phase="phase" :show-sidebar="showSidebar" :style="backgroundStyle">
    <template #header>
      <GameHeader :room-id="roomId" @leave-room="handleLeaveRoom" @copy-link="copyLink" />
    </template>

    <template #rules>
      <ul>
        <li>Each player takes turns shooting their ball toward the hole</li>
        <li><strong>Drag</strong> on the canvas to aim and set power, then release to shoot</li>
        <li>Fewest total strokes across all holes wins</li>
        <li>Maximum 10 strokes per hole — ball is holed automatically after that</li>
      </ul>
    </template>

    <MinigolfLobby
      v-if="phase === 'lobby'"
      :player-name="playerName"
      :player-color="playerColor"
      :is-host="isHost"
      :player-list="playerList"
      :room-id="roomId"
      :hole-count="holeCount"
      :selected-holes="selectedHoles"
      @update:player-name="playerName = $event"
      @update:player-color="handleColorChange"
      @update:selected-holes="handleSelectedHolesChange"
      @name-change="handleNameChange"
      @start-game="handleStartGame"
      @match-found="handleMatchFound"
      @leave-room="handleLeaveRoom"
    />

    <MinigolfGame
      v-else-if="phase === 'playing'"
      ref="gameReference"
      :message="message"
      :waiting="waiting"
      :is-aiming="isAiming"
      :aim-power="aimPower"
      :current-hole="currentHole"
      :active-holes-length="activeHoles.length"
      :par="activeHoles[currentHole]?.par ?? 0"
      :local-strokes="localStrokes"
    />

    <MinigolfSummary
      v-else
      :player-list="playerList"
      :active-holes="activeHoles"
      :is-host="isHost"
      @play-again="handlePlayAgain"
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
.mg {
  --mg-green: #4caf50;
  --mg-yellow: #ffd93d;
  --game-accent: var(--mg-green);

  background: var(--mg-bg);
  font-family: 'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive, system-ui;
}
</style>
