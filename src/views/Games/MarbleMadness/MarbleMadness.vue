<script setup lang="ts">
import '@/assets/styles/game-ui.scss'
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { loadGoogleFont, removeGoogleFont } from '@/utils/ui'
import * as THREE from 'three'
import { storeToRefs } from 'pinia'
import { useMarbleMadnessStore } from '@/stores/marbleMadness'
import { useMarbleMadnessSession } from './useMarbleMadnessSession'
import { useMarbleMadnessGame } from './useMarbleMadnessGame'
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
import { TRACKS, MARBLE_OPTIONS, DEFAULT_MARBLE } from './config'
import MultiplayerSidebar, { type MultiplayerPlayer } from '@/components/MultiplayerSidebar.vue'
import GameTabBar from '@/components/GameTabBar.vue'
import GameHeader from '@/components/GameHeader.vue'
import LobbyLayout from '@/layout/LobbyLayout.vue'
import MarbleMadnessLobby from './MarbleMadnessLobby.vue'
import MarbleMadnessGame from './MarbleMadnessGame.vue'
import MarbleMadnessSummary from './MarbleMadnessSummary.vue'

const store = useMarbleMadnessStore()
const { phase, playerList, messages, winnerId, hostId } = storeToRefs(store)

const storedProfile = loadProfile()
const playerName = ref(
  storedProfile?.name ?? `${randomPick(NAME_ADJECTIVES)}${randomPick(NAME_ANIMALS)}`
)
const playerColor = ref(storedProfile?.color ?? randomPick(PLAYER_COLORS))
const playerMarble = ref(DEFAULT_MARBLE.id)
const backgroundStyle = { backgroundImage: buildRandomGradient() }

const { roomId, resolvedRoomId } = useRoomId()

const trackIndex = ref(0)
const track = computed(() => TRACKS[trackIndex.value] ?? TRACKS[0])

const SOLO_BEST_KEY = 'mm-solo-best'
const runElapsed = ref(0)
const soloFinalTime = ref(0)
const isNewBest = ref(false)
const bestTime = ref<number | null>(
  localStorage.getItem(SOLO_BEST_KEY) !== null
    ? parseFloat(localStorage.getItem(SOLO_BEST_KEY)!)
    : null
)

const gameReference = ref<InstanceType<typeof MarbleMadnessGame> | null>(null)
const canvas = computed(() => gameReference.value?.canvas ?? null)

const marbleUrl = computed(
  () => MARBLE_OPTIONS.find((m) => m.id === playerMarble.value)?.url ?? DEFAULT_MARBLE.url
)

const session = useMarbleMadnessSession(
  {
    name: playerName.value,
    color: playerColor.value,
    marble: playerMarble.value,
    roomId: resolvedRoomId
  },
  (peerId, pos) => {
    const player = store.players[peerId]
    if (!player) return
    const marbleOption = MARBLE_OPTIONS.find((m) => m.id === player.marble)
    game.updateGhostPosition(peerId, new THREE.Color(player.color).getHex(), pos, marbleOption?.url)
  }
)
const { isHost, localPeerId } = session

const solo = computed(() => store.solo)

const game = useMarbleMadnessGame({
  canvas,
  isSolo: solo,
  track,
  marble: marbleUrl,
  onWin: () => {
    if (store.solo) {
      if (trackIndex.value < TRACKS.length - 1) {
        runElapsed.value += game.elapsed.value
        game.destroy()
        trackIndex.value += 1
        nextTick().then(() => game.init())
      } else {
        const finalTime = runElapsed.value + game.elapsed.value
        soloFinalTime.value = finalTime
        runElapsed.value = 0
        const stored = bestTime.value
        if (stored === null || finalTime < stored) {
          isNewBest.value = true
          bestTime.value = finalTime
          localStorage.setItem(SOLO_BEST_KEY, String(finalTime))
        } else {
          isNewBest.value = false
        }
        store.winnerId = localPeerId.value || 'solo'
        store.phase = 'summary'
      }
    } else {
      const raceTime =
        store.raceStartTime !== null
          ? (Date.now() - store.raceStartTime) / 1000
          : game.elapsed.value
      store.setFinishTime(localPeerId.value, raceTime)
      store.winnerId = localPeerId.value
      session.broadcastFinish(raceTime)
      store.phase = 'summary'
    }
  },
  onPositionUpdate: (pos) => session.broadcastBallPos(pos)
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
    score: p.finishTime !== null ? Math.floor(p.finishTime) : 0,
    isHost: p.id === hostId.value
  }))
)

watch(phase, async (newPhase) => {
  if (newPhase === 'playing') {
    await nextTick()
    game.init()
  }
  if (newPhase === 'lobby') {
    game.destroy()
  }
})

watch(winnerId, (id) => {
  if (id && id !== localPeerId.value) {
    game.finished.value = true
  }
})

const {
  handleNameChange,
  handleColorChange,
  handleMatchFound,
  handleLeaveRoom: leaveRoom
} = useMultiplayerLobbyHandlers(playerName, playerColor, roomId, session)

const handleMarbleChange = (marbleId: string): void => {
  playerMarble.value = marbleId
  session.updateProfile(playerName.value, playerColor.value, marbleId)
}

const takenMarbles = computed(() =>
  playerList.value
    .filter((p) => p.id !== localPeerId.value)
    .map((p) => p.marble)
    .filter(Boolean)
)

const handleLeaveRoom = (): void => {
  store.solo = false
  leaveRoom()
}

const handleConfigChange = (key: string, value: string | number): void => {
  if (key === 'trackIndex') trackIndex.value = Number(value)
}

const handleStartGame = (): void => {
  const isSolo = playerList.value.length <= 1
  if (isSolo) {
    store.solo = true
    store.upsertPlayer({
      id: localPeerId.value || 'solo',
      name: playerName.value,
      color: playerColor.value,
      marble: playerMarble.value,
      finishTime: null
    })
    store.raceStartTime = Date.now()
    store.phase = 'playing'
  } else {
    session.startGame()
  }
}

const handleRestart = (): void => {
  if (store.solo) {
    runElapsed.value = 0
    trackIndex.value = 0
    store.winnerId = null
    store.phase = 'playing'
  } else {
    session.restartGame()
  }
}

const MM_FONT_KEY = 'mm-font'

onMounted(() => {
  session.init()
  loadGoogleFont(
    'https://fonts.googleapis.com/css2?family=Darumadrop+One&display=swap',
    MM_FONT_KEY
  )
})

onUnmounted(() => {
  removeGoogleFont(MM_FONT_KEY)
})
</script>

<template>
  <LobbyLayout
    class="mm"
    :phase="phase"
    :show-sidebar="showSidebar"
    :sidebar-visible="!store.solo"
    :main-placement="phase !== 'lobby' ? 'fill' : 'center'"
    :style="backgroundStyle"
  >
    <template #header>
      <GameHeader @leave-room="handleLeaveRoom" />
    </template>

    <template #rules>
      <ul>
        <li>
          Roll your marble to the gold finish circle using <strong>WASD</strong> or arrow keys
        </li>
        <li>Avoid falling off the edges — you respawn at the start</li>
        <li>In multiplayer, first marble to reach the finish wins</li>
        <li>Watch out for the red obstacle pillars on Platform 2</li>
      </ul>
    </template>

    <MarbleMadnessLobby
      v-if="phase === 'lobby'"
      :player-name="playerName"
      :player-color="playerColor"
      :player-marble="playerMarble"
      :taken-marbles="takenMarbles"
      :is-host="isHost"
      :player-list="playerList"
      :room-id="roomId"
      @update:player-name="playerName = $event"
      @update:player-color="handleColorChange"
      @name-change="handleNameChange"
      @start-game="handleStartGame"
      @match-found="handleMatchFound"
      @leave-room="handleLeaveRoom"
      @config-change="handleConfigChange"
      @marble-change="handleMarbleChange"
    />

    <div v-else class="mm__play-area">
      <MarbleMadnessGame
        ref="gameReference"
        :elapsed="game.elapsed.value"
        :finished="game.finished.value"
        :penalty-count="game.penaltyCount.value"
      />
      <MarbleMadnessSummary
        v-if="phase === 'summary'"
        :player-list="playerList"
        :winner-id="winnerId"
        :local-peer-id="localPeerId"
        :is-host="isHost || store.solo"
        :is-solo="store.solo"
        :solo-final-time="soloFinalTime"
        :best-time="bestTime"
        :is-new-best="isNewBest"
        @restart="handleRestart"
        @leave-room="handleLeaveRoom"
      />
    </div>

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
.mm {
  --mm-accent: #ff6b35;

  background: var(--lb-bg);
  font-family: 'Segoe UI', system-ui, sans-serif;
}

.mm__play-area {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
