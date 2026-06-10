<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePictionaryStore } from '@/stores/pictionary'
import type { StrokeEvent, FillEvent } from '@webgamekit/canvas-editor'
import { usePictionarySession } from './usePictionarySession'
import { usePictionaryTimer } from './usePictionaryTimer'
import {
  buildRandomGradient,
  randomPick,
  loadProfile,
  saveProfile,
  NAME_ADJECTIVES,
  NAME_ANIMALS,
  PLAYER_COLORS
} from './constants'
import GameHeader from '@/components/GameHeader.vue'
import LobbyLayout from '@/layout/LobbyLayout.vue'
import PictionaryLobby from './PictionaryLobby.vue'
import PictionaryChoosing from './PictionaryChoosing.vue'
import PictionaryDrawing from './PictionaryDrawing.vue'
import PictionaryIntermission from './PictionaryIntermission.vue'
import PictionarySummary from './PictionarySummary.vue'
import MultiplayerSidebar, { type MultiplayerPlayer } from '@/components/MultiplayerSidebar.vue'
import GameTabBar from '@/components/GameTabBar.vue'

const route = useRoute()
const router = useRouter()
const store = usePictionaryStore()
const {
  phase,
  round,
  playerList,
  messages,
  winnerId,
  totalRounds,
  roundDuration,
  wordCount,
  hintCount,
  intermissionEndsAt,
  revealedHintIndices,
  difficulty
} = storeToRefs(store)

const storedProfile = loadProfile()
const playerName = ref(
  storedProfile?.name ?? `${randomPick(NAME_ADJECTIVES)}${randomPick(NAME_ANIMALS)}`
)
const playerColor = ref(storedProfile?.color ?? randomPick(PLAYER_COLORS))
const backgroundStyle = { backgroundImage: buildRandomGradient() }
const drawingReference = ref<InstanceType<typeof PictionaryDrawing> | null>(null)

const resolvedRoomId = ((): string => {
  const existing = route.query.room as string | undefined
  if (existing) return existing
  const next = crypto.randomUUID()
  router.replace({ query: { ...route.query, room: next } })
  return next
})()

const roomId = ref(resolvedRoomId)

const maskedWord = computed(() => {
  const word = round.value.word
  if (!word) return ''
  const indices = new Set(revealedHintIndices.value)
  return [...word].map((char, i) => (char === ' ' ? ' ' : indices.has(i) ? char : '_')).join('')
})

const session = usePictionarySession({
  name: playerName.value,
  color: playerColor.value,
  roomId: resolvedRoomId,
  onRemoteStroke: (payload) => drawingReference.value?.renderSegment(payload),
  onRemoteFill: (payload) => drawingReference.value?.renderFill(payload),
  onRemoteRestore: (dataUrl) => drawingReference.value?.silentRestore(dataUrl),
  onRemoteClear: () => drawingReference.value?.silentClear()
})

const { isHost, isDrawer, localPeerId } = session
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
    isHost: p.id === store.hostId,
    isDrawer: p.id === round.value.drawerId
  }))
)

const { timeLeft, intermissionLeft } = usePictionaryTimer({
  round,
  phase,
  intermissionEndsAt,
  isHost,
  isDrawer,
  onRoundTimeout: () => session.endRound(),
  onChoiceTimeout: (choices) => {
    session.pickWord(choices[Math.floor(Math.random() * choices.length)])
  }
})

const shareableLink = computed(() => {
  if (!roomId.value) return ''
  const url = new URL(window.location.href)
  url.searchParams.set('room', roomId.value)
  return url.toString()
})

const copyLink = async (): Promise<void> => {
  if (!shareableLink.value) return
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

const handleStroke = (event: StrokeEvent): void => {
  session.broadcastStroke(event)
}

const handleFill = (event: FillEvent): void => {
  session.broadcastFill(event)
}

const handleUndoRedo = (dataUrl: string): void => {
  session.broadcastCanvasRestore(dataUrl)
}

onMounted(() => {
  store.reset()
  session.init()
})
</script>

<template>
  <LobbyLayout
    class="pictionary"
    :phase="phase"
    :show-sidebar="showSidebar"
    sidebar-width="320px"
    :hide-header-on-mobile="['drawing', 'choosing'].includes(phase)"
    :style="backgroundStyle"
    @leave-room="handleLeaveRoom"
  >
    <template #header>
      <GameHeader :room-id="roomId" @copy-link="copyLink" />
    </template>

    <template #rules>
      <ul>
        <li>The drawer is given a word and must draw it without speaking</li>
        <li>Guessers earn points based on speed — faster guesses score more</li>
        <li>First correct guess gets a bonus</li>
        <li>The drawer earns points per correct guess, scaled by time remaining</li>
        <li>Hints reveal extra letters (configurable)</li>
        <li>Round ends when time runs out or all players guess correctly</li>
      </ul>
    </template>

    <PictionaryLobby
      v-if="phase === 'lobby'"
      :player-name="playerName"
      :player-color="playerColor"
      :is-host="isHost"
      :player-list="playerList"
      :room-id="roomId"
      :difficulty="difficulty"
      :total-rounds="totalRounds"
      :round-duration="roundDuration"
      :word-count="wordCount"
      :hint-count="hintCount"
      @update:player-name="playerName = $event"
      @update:player-color="handleColorChange"
      @update:difficulty="difficulty = $event"
      @update:total-rounds="totalRounds = $event"
      @update:round-duration="roundDuration = $event"
      @update:word-count="wordCount = $event"
      @update:hint-count="hintCount = $event"
      @name-change="handleNameChange"
      @start-game="session.startRound()"
      @match-found="handleMatchFound"
      @leave-room="handleLeaveRoom"
    />

    <PictionaryChoosing
      v-else-if="phase === 'choosing'"
      :is-drawer="isDrawer"
      :drawer-id="round.drawerId"
      :choices="round.choices"
      :time-left="timeLeft"
      :player-list="playerList"
      @pick-word="session.pickWord($event)"
    />

    <PictionaryDrawing
      v-else-if="phase === 'drawing'"
      ref="drawingReference"
      :is-drawer="isDrawer"
      :word="round.word"
      :masked-word="maskedWord"
      :round-number="round.number"
      :total-rounds="totalRounds"
      :time-left="timeLeft"
      @stroke="handleStroke"
      @fill="handleFill"
      @undo="handleUndoRedo"
      @redo="handleUndoRedo"
      @clear="session.broadcastClear()"
    />

    <PictionaryIntermission
      v-else-if="phase === 'intermission'"
      :round-number="round.number"
      :total-rounds="totalRounds"
      :intermission-left="intermissionLeft"
      :word="round.word"
    />

    <PictionarySummary
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
        :chat-placeholder="isDrawer ? 'Drawer cannot chat' : 'Say something…'"
        :chat-disabled="isDrawer && phase === 'drawing'"
        @send="session.broadcastChat($event)"
      />
    </template>

    <template #tabbar>
      <GameTabBar v-model:show-sidebar="showSidebar" :unread-count="unreadCount" />
    </template>
  </LobbyLayout>
</template>

<style scoped>
.pictionary {
  --pic-yellow: #ffd93d;
  --game-accent: var(--pic-yellow);
  --pic-pink: #ff6bcb;
  --pic-blue: #4ecdc4;
  --pic-orange: #ff8c42;
  --pic-purple: #a06cd5;
  --pic-green: #6bcf7f;

  background: var(--pic-bg);
  font-family: 'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive, system-ui;
}
</style>
