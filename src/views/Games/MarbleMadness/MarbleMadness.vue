<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
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
import { TRACKS } from './config'
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
const backgroundStyle = { backgroundImage: buildRandomGradient() }

const { roomId, resolvedRoomId } = useRoomId()

const trackIndex = ref(0)
const track = computed(() => TRACKS[trackIndex.value] ?? TRACKS[0])

const gameReference = ref<InstanceType<typeof MarbleMadnessGame> | null>(null)
const canvas = computed(() => gameReference.value?.canvas ?? null)

const session = useMarbleMadnessSession(
  { name: playerName.value, color: playerColor.value, roomId: resolvedRoomId },
  (peerId, pos) => {
    const player = store.players[peerId]
    if (player) game.updateGhostPosition(peerId, new THREE.Color(player.color).getHex(), pos)
  }
)
const { isHost, localPeerId } = session

const solo = computed(() => store.solo)

const game = useMarbleMadnessGame({
  canvas,
  isSolo: solo,
  track,
  onWin: () => {
    if (store.solo) {
      store.phase = 'summary'
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
    class="mm"
    :phase="phase"
    :show-sidebar="showSidebar"
    :sidebar-visible="!store.solo"
    :main-placement="phase === 'playing' ? 'fill' : 'center'"
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
    />

    <MarbleMadnessGame
      v-else-if="phase === 'playing'"
      ref="gameReference"
      :elapsed="game.elapsed.value"
      :finished="game.finished.value"
      :penalty-count="game.penaltyCount.value"
    />

    <MarbleMadnessSummary
      v-else
      :player-list="playerList"
      :winner-id="winnerId"
      :local-peer-id="localPeerId"
      :is-host="isHost || store.solo"
      :is-solo="store.solo"
      :elapsed-time="game.elapsed.value"
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
.mm {
  --mm-accent: #ff6b35;

  background: var(--lb-bg);
  font-family: 'Segoe UI', system-ui, sans-serif;
}
</style>
