<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { isMobile } from '@webgamekit/controls'
import { useBrickBreakerStore } from '@/stores/brickBreaker'
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
import { loadGoogleFont, removeGoogleFont } from '@/utils/ui'
import MultiplayerSidebar, { type MultiplayerPlayer } from '@/components/MultiplayerSidebar.vue'
import GameTabBar from '@/components/GameTabBar.vue'
import GameHeader from '@/components/GameHeader.vue'
import LobbyLayout from '@/layout/LobbyLayout.vue'
import '@/assets/styles/lobby-ui.scss'
import BrickBreakerLobby from './BrickBreakerLobby.vue'
import BrickBreakerRules from './BrickBreakerRules.vue'
import BrickBreakerGame from './BrickBreakerGame.vue'
import BrickBreakerSummary from './BrickBreakerSummary.vue'
import { useBrickBreakerSession } from './useBrickBreakerSession'
import { useBrickBreakerGame } from './useBrickBreakerGame'
import { SCORE_POPUP_DURATION_MS, SPRINT_DURATION_MS, TOUCH_BUTTON_BAND_PX } from './config'
import type { BbScorePopup } from './types'

const LOBBY_UI_FONT = 'https://fonts.googleapis.com/css2?family=Darumadrop+One&display=swap'
const FONT_KEY = 'brick-breaker-font'

const store = useBrickBreakerStore()
const { phase, playerList, players, messages, hostId, matchLength } = storeToRefs(store)

const storedProfile = loadProfile()
const playerName = ref(
  storedProfile?.name ?? `${randomPick(NAME_ADJECTIVES)}${randomPick(NAME_ANIMALS)}`
)
const playerColor = ref(storedProfile?.color ?? randomPick(PLAYER_COLORS))
const backgroundStyle = { backgroundImage: buildRandomGradient() }

const { roomId, resolvedRoomId } = useRoomId()

const gameReference = ref<InstanceType<typeof BrickBreakerGame> | null>(null)
const canvas = computed(() => gameReference.value?.canvas ?? null)
const isSolo = computed(() => store.solo)

const scorePopups = ref<BbScorePopup[]>([])
const nextPopupId = ref(0)

const showPopup = (popup: Omit<BbScorePopup, 'id'>): void => {
  const id = nextPopupId.value
  nextPopupId.value += 1
  scorePopups.value = [...scorePopups.value, { ...popup, id }]
  setTimeout(() => {
    scorePopups.value = scorePopups.value.filter((item) => item.id !== id)
  }, SCORE_POPUP_DURATION_MS)
}

const session = useBrickBreakerSession(
  { name: playerName.value, color: playerColor.value, roomId: resolvedRoomId },
  {
    onMatchStart: async (payload) => {
      scorePopups.value = []
      await nextTick()
      await game.start(payload)
    },
    onGarbage: (rows) => game.receiveGarbage(rows),
    onSurvivorFinish: () => game.finish()
  }
)
const { isHost, localPlayerId, ranking } = session

const game = useBrickBreakerGame({
  canvas,
  isSolo,
  touchButtonBandPx: isMobile() ? TOUCH_BUTTON_BAND_PX : 0,
  onScore: (score, popup) => {
    session.broadcastScore(score)
    showPopup(popup)
  },
  onGarbageSent: (rows) => session.broadcastGarbage(rows),
  onEnd: (score, isEliminated) => {
    session.broadcastScore(score)
    session.reportResult(score, isEliminated)
  }
})

const showSidebar = ref(false)
const lastReadCount = ref(0)
const unreadCount = computed(() => Math.max(0, messages.value.length - lastReadCount.value))

watch([showSidebar, messages], () => {
  if (showSidebar.value) lastReadCount.value = messages.value.length
})

const sidebarPlayers = computed((): MultiplayerPlayer[] =>
  playerList.value.map((player) => ({
    id: player.id,
    name: player.name,
    color: player.color,
    score: player.score,
    isHost: player.id === hostId.value
  }))
)

// Leaving or switching rooms starts a fresh session, so the old room's players must go too.
const lobbySession = {
  updateProfile: session.updateProfile,
  reconnect: (newRoomId: string): void => {
    game.destroy()
    store.reset()
    session.reconnect(newRoomId)
  }
}

const {
  handleNameChange,
  handleColorChange,
  handleMatchFound,
  handleLeaveRoom: leaveRoom
} = useMultiplayerLobbyHandlers(playerName, playerColor, roomId, lobbySession)

const handleLeaveRoom = (): void => {
  store.solo = false
  leaveRoom()
}

const matchDurationMs = (): number | null =>
  matchLength.value === 'sprint' ? SPRINT_DURATION_MS : null

const handleStartGame = (): void => {
  store.solo = playerList.value.length <= 1
  if (store.solo && !players.value[localPlayerId.value]) {
    store.upsertPlayer({
      id: localPlayerId.value,
      name: playerName.value,
      color: playerColor.value,
      score: 0
    })
  }
  session.startMatch(matchDurationMs())
}

const canRestart = computed(() => isHost.value || store.solo)

onMounted(() => {
  store.reset()
  session.init()
  loadGoogleFont(LOBBY_UI_FONT, FONT_KEY)
})

onUnmounted(() => removeGoogleFont(FONT_KEY))
</script>

<template>
  <LobbyLayout
    class="bb"
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
      <BrickBreakerRules />
    </template>

    <BrickBreakerLobby
      v-if="phase === 'lobby'"
      :player-name="playerName"
      :player-color="playerColor"
      :is-host="isHost"
      :player-list="playerList"
      :room-id="roomId"
      :match-length="matchLength"
      @update:player-name="playerName = $event"
      @update:player-color="handleColorChange"
      @update:match-length="matchLength = $event"
      @name-change="handleNameChange"
      @start-game="handleStartGame"
      @match-found="handleMatchFound"
      @leave-room="handleLeaveRoom"
    />

    <div v-else class="bb__stage">
      <BrickBreakerGame
        ref="gameReference"
        :score="game.score.value"
        :high-score="game.highScore.value"
        :lives="game.lives.value"
        :countdown-seconds="game.countdownSeconds.value"
        :remaining-seconds="game.remainingSeconds.value"
        :score-popups="scorePopups"
        :current-actions="game.currentActions.value"
      />
      <BrickBreakerSummary
        v-if="phase === 'summary'"
        :ranking="ranking"
        :players="players"
        :local-player-id="localPlayerId"
        :is-solo="store.solo"
        :can-restart="canRestart"
        :high-score="game.highScore.value"
        @restart="handleStartGame"
      />
    </div>

    <template v-if="!store.solo" #sidebar>
      <MultiplayerSidebar
        :players="sidebarPlayers"
        :local-peer-id="localPlayerId"
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
.bb {
  background: var(--lb-bg);
  font-family: var(--lui-font);
}

.bb__stage {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
