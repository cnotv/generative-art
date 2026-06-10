<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRhythmGameStore } from '@/stores/rhythmGame'
import { useRhythmGameSession } from './useRhythmGameSession'
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
import LobbyLayout from '@/layout/LobbyLayout.vue'
import GameHeader from '@/components/GameHeader.vue'
import MultiplayerSidebar, { type MultiplayerPlayer } from '@/components/MultiplayerSidebar.vue'
import GameTabBar from '@/components/GameTabBar.vue'
import RhythmGameLobby from './RhythmGameLobby.vue'
import RhythmGameGame from './RhythmGameGame.vue'
import type { RgSong, RgDifficulty, RhythmNote } from './config'
import type { RgScore } from '@/stores/rhythmGame'
import type { ScheduledNote } from '@webgamekit/audio'

const store = useRhythmGameStore()
const {
  phase,
  playerList,
  messages,
  winnerId,
  hostId,
  song,
  difficulty,
  instrument,
  customNotes,
  customSongName,
  backgroundNotes,
  solo
} = storeToRefs(store)

const storedProfile = loadProfile()
const playerName = ref(
  storedProfile?.name ?? `${randomPick(NAME_ADJECTIVES)}${randomPick(NAME_ANIMALS)}`
)
const playerColor = ref(storedProfile?.color ?? randomPick(PLAYER_COLORS))
const backgroundStyle = { backgroundImage: buildRandomGradient() }

const { roomId, resolvedRoomId } = useRoomId()

const session = useRhythmGameSession({
  name: playerName.value,
  color: playerColor.value,
  roomId: resolvedRoomId
})
const { isHost, localPeerId } = session

const gameStartAt = ref(0)

session.onStart((payload) => {
  store.song = payload.song
  store.difficulty = payload.difficulty
  gameStartAt.value = payload.startAt
})

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

const {
  handleNameChange,
  handleColorChange,
  handleMatchFound,
  handleLeaveRoom: leaveRoom
} = useMultiplayerLobbyHandlers(playerName, playerColor, roomId, session)

const handleLeaveRoom = (): void => {
  store.phase = 'lobby'
  store.solo = false
  store.customNotes = null
  store.backgroundNotes = null
  store.customSongName = ''
  leaveRoom()
}

const handleMidiParsed = (
  gameNotes: RhythmNote[],
  bgNotes: ScheduledNote[],
  songName: string
): void => {
  store.customNotes = gameNotes.length > 0 ? gameNotes : null
  store.backgroundNotes = bgNotes.length > 0 ? bgNotes : null
  store.customSongName = songName
  store.song = 'custom'
}

const handleStartGame = (): void => {
  const isSolo = playerList.value.length <= 1
  if (isSolo) {
    store.solo = true
    store.upsertPlayer({
      id: localPeerId.value || 'solo',
      name: playerName.value,
      color: playerColor.value,
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfect: 0,
      good: 0,
      miss: 0
    })
    gameStartAt.value = Date.now() + 3000
    store.phase = 'playing'
  } else {
    session.startGame()
  }
}

const handleScoreUpdate = (data: RgScore): void => {
  store.updateScore(localPeerId.value || 'solo', data)
  if (!store.solo) {
    session.broadcastScore(data)
  }
}

const handleSongEnd = (): void => {
  if (store.solo) {
    store.phase = 'summary'
  } else {
    session.broadcastGameOver()
    store.winnerId = null
    store.phase = 'summary'
  }
}

const handleRestart = (): void => {
  if (store.solo) {
    store.resetForReplay()
    gameStartAt.value = Date.now() + 3000
    store.phase = 'playing'
  } else {
    session.restartGame()
    session.startGame()
  }
}

onMounted(() => {
  store.reset()
  session.init()
})
</script>

<template>
  <LobbyLayout
    class="rg"
    :phase="phase"
    :show-sidebar="showSidebar"
    :main-placement="phase === 'playing' ? 'fill' : 'center'"
    :style="backgroundStyle"
    @leave-room="handleLeaveRoom"
  >
    <template #header>
      <GameHeader />
    </template>

    <template #rules>
      <ul>
        <li>Notes fall toward the hit zone — press the matching lane key when they arrive</li>
        <li>Perfect ≤ 50 ms · Good ≤ 120 ms · Miss = combo reset</li>
        <li>Combo multiplier stacks at ×2, ×4, ×8 — keep the streak alive</li>
        <li>Keyboard: D F J K · Arrows · Faux-pad: swipe directions</li>
        <li>In multiplayer — same song, same start time, highest score wins</li>
      </ul>
    </template>

    <RhythmGameLobby
      v-if="phase === 'lobby' || phase === 'summary'"
      :show-results="phase === 'summary'"
      :player-name="playerName"
      :player-color="playerColor"
      :is-host="isHost || store.solo"
      :player-list="playerList"
      :rg-player-list="playerList"
      :room-id="roomId"
      :winner-id="winnerId"
      :local-peer-id="localPeerId || 'solo'"
      @update:player-name="playerName = $event"
      @update:player-color="handleColorChange"
      @name-change="handleNameChange"
      @start-game="handleStartGame"
      @match-found="handleMatchFound"
      @leave-room="handleLeaveRoom"
      @play-again="handleRestart"
      @midi-parsed="handleMidiParsed"
    />

    <RhythmGameGame
      v-else-if="phase === 'playing'"
      :song="song"
      :difficulty="difficulty"
      :instrument="instrument"
      :custom-notes="customNotes"
      :background-notes="backgroundNotes"
      :song-name="customSongName || undefined"
      :start-at="gameStartAt"
      :opponent-name="opponentPlayer?.name"
      :opponent-score="opponentPlayer?.score"
      @score-update="handleScoreUpdate"
      @song-end="handleSongEnd"
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
.rg {
  --rg-accent: #00e5ff;
  --game-accent: var(--rg-accent);

  background: #07070f;
  font-family: 'Segoe UI', system-ui, sans-serif;
}
</style>
