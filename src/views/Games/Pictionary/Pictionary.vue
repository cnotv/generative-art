<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePictionaryStore } from '@/stores/pictionary'
import type { StrokeEvent } from '@webgamekit/canvas-editor'
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
import PictionaryHeader from './PictionaryHeader.vue'
import PictionaryLobby from './PictionaryLobby.vue'
import PictionaryChoosing from './PictionaryChoosing.vue'
import PictionaryDrawing from './PictionaryDrawing.vue'
import PictionaryIntermission from './PictionaryIntermission.vue'
import PictionarySummary from './PictionarySummary.vue'
import PictionarySidebar from './PictionarySidebar.vue'

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
const backgroundStyle = { background: buildRandomGradient() }
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
  onRemoteClear: () => drawingReference.value?.silentClear()
})

const { isHost, isDrawer, localPeerId } = session

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

onMounted(() => {
  session.init()
})
</script>

<template>
  <main class="pictionary" :class="`pictionary--${phase}`" :style="backgroundStyle">
    <PictionaryHeader :room-id="roomId" @copy-link="copyLink" />

    <PictionaryLobby
      v-if="phase === 'lobby'"
      :player-name="playerName"
      :player-color="playerColor"
      :is-host="isHost"
      :player-list="playerList"
      :round="round"
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

    <PictionarySidebar
      :player-list="playerList"
      :drawer-id="round.drawerId"
      :host-id="store.hostId"
      :messages="messages"
      :local-peer-id="localPeerId"
      :is-drawer="isDrawer"
      :phase="phase"
      @send="session.broadcastChat($event)"
    />
  </main>
</template>

<style scoped>
.pictionary {
  --pic-yellow: #ffd93d;
  --pic-pink: #ff6bcb;
  --pic-blue: #4ecdc4;
  --pic-orange: #ff8c42;
  --pic-purple: #a06cd5;
  --pic-green: #6bcf7f;

  touch-action: manipulation;
  display: grid;
  grid-template-columns: 1fr 320px;
  grid-template-areas: 'header header' 'main sidebar';
  grid-template-rows: auto 1fr;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  padding-top: calc(var(--nav-height) + var(--spacing-3));
  min-height: 100vh;
  box-sizing: border-box;
  background: #fff7e6;
  font-family: 'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive, system-ui;
}

@media (max-width: 720px) {
  .pictionary {
    grid-template-columns: 1fr;
    grid-template-areas: 'header' 'main' 'sidebar';
    grid-template-rows: auto auto 1fr;
    height: 100dvh;
    min-height: 0;
    padding: 0 var(--spacing-2);
    padding-top: var(--nav-height);
    padding-bottom: var(--spacing-2);
    gap: var(--spacing-2);
    overflow: hidden;
  }

  .pictionary--lobby {
    grid-template-rows: auto 1fr auto;
    height: auto;
    min-height: 100dvh;
    overflow: auto;
  }

  .pictionary--drawing,
  .pictionary--choosing {
    grid-template-rows: auto minmax(0, 1fr) auto;
  }

  .pictionary--drawing :deep(.pictionary-header),
  .pictionary--choosing :deep(.pictionary-header) {
    display: none;
  }
}
</style>
