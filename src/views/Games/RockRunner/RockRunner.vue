<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as THREE from 'three'
import { loadGoogleFont, removeGoogleFont } from '@/utils/ui'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useRockRunnerStore } from '@/stores/rockRunner'
import { useRoomId } from '@/composables/useRoomId'
import { useMultiplayerLobbyHandlers } from '@/composables/useMultiplayerLobbyHandlers'
import {
  loadProfile,
  randomPick,
  NAME_ADJECTIVES,
  NAME_ANIMALS,
  PLAYER_COLORS
} from '@/utils/playerProfile'
import '@/assets/styles/lobby-ui.scss'
import LobbyLayout from '@/layout/LobbyLayout.vue'
import GameHeader from '@/components/GameHeader.vue'
import MultiplayerSidebar, { type MultiplayerPlayer } from '@/components/MultiplayerSidebar.vue'
import GameTabBar from '@/components/GameTabBar.vue'
import { LobbyUIButton, LobbyUIKeyPill, LobbyUIConfirm } from '@/components/LobbyUI'
import { Video, LogOut } from 'lucide-vue-next'
import { isMobile } from '@webgamekit/controls'
import TouchControl from '@/components/TouchControl.vue'
import { useRockRun } from './game/useRockRun'
import { useRockRunnerSession } from './useRockRunnerSession'
import RockRunnerLobby from './wizard/RockRunnerLobby.vue'
import RockRunnerRules from './wizard/RockRunnerRules.vue'
import RockRunnerSummary from './game/RockRunnerSummary.vue'
import { CONFIG_STORAGE_KEY } from './config'
import type { CameraMode } from './types'

const CAMERA_MODE_LABELS: Record<CameraMode, string> = {
  third: 'Third',
  first: 'First',
  free: 'Free'
}

const MAX_SEED = 9999

const isMobileDevice = isMobile()

const store = useRockRunnerStore()
const { phase, playerList, messages, hostId, runStartTime, trackSeed } = storeToRefs(store)

type StoredLobbyConfig = {
  trackSeed?: number
}

const loadLobbyConfig = (): StoredLobbyConfig => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) ?? '{}')
    return typeof parsed === 'object' && parsed !== null ? (parsed as StoredLobbyConfig) : {}
  } catch {
    return {}
  }
}

const storedLobbyConfig = loadLobbyConfig()
const storedProfile = loadProfile()

const playerName = ref(
  storedProfile?.name ?? `${randomPick(NAME_ADJECTIVES)}${randomPick(NAME_ANIMALS)}`
)
const playerColor = ref(storedProfile?.color ?? randomPick(PLAYER_COLORS))
const selectedSeed = ref(storedLobbyConfig.trackSeed ?? Math.floor(Math.random() * MAX_SEED) + 1)

const { roomId, resolvedRoomId } = useRoomId()

const runCanvas = ref<HTMLCanvasElement | null>(null)

const session = useRockRunnerSession(
  {
    name: playerName.value,
    color: playerColor.value,
    roomId: resolvedRoomId
  },
  {
    onSeedReceived: (seed) => {
      selectedSeed.value = seed
    },
    onRockPos: (peerId, pos) => {
      const player = store.players[peerId]
      if (!player) return
      run.updateGhostPosition({
        peerId,
        colorHex: new THREE.Color(player.color).getHex(),
        pos,
        name: player.name,
        nameColor: player.color
      })
    }
  }
)
const { isHost, localPeerId } = session

const localId = (): string => localPeerId.value || 'solo'

const sortedPeerIds = computed(() => Object.keys(store.players).sort())
const spawnGateCount = computed(() => Math.max(1, sortedPeerIds.value.length))
const spawnGateIndex = computed(() => Math.max(0, sortedPeerIds.value.indexOf(localId())))

const run = useRockRun({
  canvas: runCanvas,
  routeName: String(useRoute().name ?? 'RockRunner'),
  seed: trackSeed,
  runStartTime,
  localPlayerName: playerName,
  localPlayerColor: playerColor,
  spawnGateCount,
  spawnGateIndex,
  onExit: () => requestExitGame(),
  onPositionUpdate: (pos) => {
    store.setDistance(localId(), pos.d)
    if (!store.solo) session.broadcastRockPos(pos)
  }
})

const formattedDistance = computed(() => `${Math.round(run.distance.value)} m`)

const formattedTime = computed(() => {
  const total = run.elapsed.value
  const minutes = Math.floor(total / 60)
  const seconds = (total % 60).toFixed(1).padStart(4, '0')
  return `${minutes}:${seconds}`
})

const persistLobbyConfig = (): void => {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ trackSeed: selectedSeed.value }))
}

const handleConfigChange = (key: string, value: string | number): void => {
  if (key !== 'trackSeed') return
  selectedSeed.value = Math.max(1, Math.min(MAX_SEED, Math.round(Number(value))))
  persistLobbyConfig()
}

const upsertLocalPlayer = (): void => {
  store.upsertPlayer({
    id: localId(),
    name: playerName.value,
    color: playerColor.value,
    distance: 0
  })
}

const handleStartGame = (): void => {
  store.solo = playerList.value.length <= 1
  upsertLocalPlayer()
  session.startRun(selectedSeed.value)
}

const {
  handleNameChange,
  handleColorChange,
  handleMatchFound,
  handleLeaveRoom: leaveRoom
} = useMultiplayerLobbyHandlers(playerName, playerColor, roomId, session)

const handleLeaveRoom = (): void => {
  store.solo = false
  store.phase = 'lobby'
  leaveRoom()
}

const canRestart = computed(() => store.solo || isHost.value)

const cameraLabel = computed(() => CAMERA_MODE_LABELS[run.cameraMode.value])

const handleRestart = (): void => {
  session.startRun(selectedSeed.value)
}

const handleBackToLobby = (): void => {
  session.returnToLobby()
}

type RunConfirm = { message: string; confirmLabel: string; onConfirm: () => void }
const runConfirm = ref<RunConfirm | null>(null)

const requestExitGame = (): void => {
  runConfirm.value = {
    message: 'Exit the game?',
    confirmLabel: 'Exit',
    onConfirm: handleLeaveRoom
  }
}

const confirmRunDialog = (): void => {
  const pending = runConfirm.value
  runConfirm.value = null
  pending?.onConfirm()
}

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
  playerList.value.map((player) => ({
    id: player.id,
    name: player.name,
    color: player.color,
    score: Math.round(player.distance),
    isHost: player.id === hostId.value
  }))
)

watch(phase, async (newPhase, oldPhase) => {
  if (newPhase === 'run') {
    if (oldPhase === 'run' || oldPhase === 'summary') run.destroy()
    await nextTick()
    await run.init()
    return
  }
  if (newPhase === 'lobby') {
    run.destroy()
  }
})

const RR_FONT_KEY = 'rr-font'

onMounted(() => {
  store.reset()
  session.init()
  loadGoogleFont(
    'https://fonts.googleapis.com/css2?family=Darumadrop+One&display=swap',
    RR_FONT_KEY
  )
})

onUnmounted(() => {
  removeGoogleFont(RR_FONT_KEY)
})
</script>

<template>
  <LobbyLayout
    class="rr"
    :phase="phase"
    :show-sidebar="showSidebar"
    :sidebar-visible="!store.solo"
    :main-placement="phase !== 'lobby' ? 'fill' : 'center'"
    @leave-room="handleLeaveRoom"
  >
    <template #header>
      <GameHeader :phase="phase" />
    </template>

    <template #rules>
      <RockRunnerRules />
    </template>

    <template v-if="phase === 'lobby'">
      <RockRunnerLobby
        :player-name="playerName"
        :player-color="playerColor"
        :is-host="isHost"
        :player-list="playerList"
        :room-id="roomId"
        :track-seed="selectedSeed"
        @update:player-name="playerName = $event"
        @update:player-color="handleColorChange"
        @name-change="handleNameChange"
        @start-game="handleStartGame"
        @match-found="handleMatchFound"
        @leave-room="handleLeaveRoom"
        @config-change="handleConfigChange"
      />
    </template>

    <div v-else class="rr__play-area">
      <canvas ref="runCanvas" class="rr__canvas"></canvas>
      <div class="rr__hud">
        <span class="rr__distance">{{ formattedDistance }}</span>
        <span class="rr__timer">{{ formattedTime }}</span>
        <LobbyUIButton
          size="sm"
          variant="ghost"
          :title="`Camera: ${cameraLabel} — click or press C to cycle`"
          @click="run.cycleCameraMode"
        >
          <Video class="rr__hud-icon" aria-hidden="true" />
          <span class="rr__hud-label">Cam: {{ cameraLabel }}</span>
          <LobbyUIKeyPill class="rr__hud-key" :keyboard="['C']" :gamepad="['△']" />
        </LobbyUIButton>
        <LobbyUIButton size="sm" variant="ghost" title="Exit the game" @click="requestExitGame">
          <LogOut class="rr__hud-icon" aria-hidden="true" />
          <span class="rr__hud-label">Exit</span>
          <LobbyUIKeyPill class="rr__hud-key" :keyboard="['Esc']" :gamepad="['○']" />
        </LobbyUIButton>
      </div>
      <TouchControl
        v-if="isMobileDevice && run.currentActions.value"
        class="rr__fauxpad"
        :mapping="{ up: 'jump', down: 'jump', left: 'left', right: 'right' }"
        :options="{ deadzone: 0.15 }"
        :current-actions="run.currentActions.value"
        :on-action="() => {}"
      />
      <div v-if="run.countdown.value > 0" class="rr__countdown">
        {{ run.countdown.value }}
      </div>
      <RockRunnerSummary
        v-if="phase === 'summary'"
        :player-list="playerList"
        :local-peer-id="localId()"
        :can-restart="canRestart"
        @restart="handleRestart"
        @back="handleBackToLobby"
      />
      <LobbyUIConfirm
        v-if="runConfirm"
        :message="runConfirm.message"
        :confirm-label="runConfirm.confirmLabel"
        cancel-label="Keep rolling"
        @confirm="confirmRunDialog"
        @cancel="runConfirm = null"
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
.rr {
  background: var(--lb-bg);
}

.rr__play-area {
  position: relative;
  width: 100%;
  height: 100%;
}

.rr__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.rr__hud {
  position: absolute;
  top: var(--spacing-4);
  left: 50%;
  z-index: var(--z-dropdown);
  display: flex;
  flex-wrap: nowrap;
  gap: var(--spacing-4);
  align-items: center;
  white-space: nowrap;
  transform: translateX(-50%);
}

.rr__hud-label {
  /* THIRD, FIRST and FREE are not the same width, so the row shifted on every
     camera change for the same reason the counters did. */
  min-width: 10ch;
  text-align: left;
  white-space: nowrap;
}

.rr__hud-icon {
  display: none;
  width: 1.1em;
  height: 1.1em;
}

/* Phones have no keyboard and little width: collapse the HUD buttons to their
   icon only, matching the marble editor's HUD. */
@media (width <= 720px) {
  .rr__hud-icon {
    display: inline-flex;
  }

  .rr__hud-label,
  .rr__hud-key {
    display: none;
  }
}

/* Both counters reserve the width of their longest reading rather than growing
   into it. Tabular figures already keep the digits themselves equal, but the
   HUD is centred, so gaining a digit widened the row and slid everything in it
   sideways. Right-aligned, so the unit and the seconds stay put and only the
   leading digits extend into the reserved space. */
.rr__distance {
  min-width: 7ch;
  font-family: var(--lui-font);
  font-size: var(--lui-text-medium);
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  color: var(--lui-text-color);
  text-align: right;
  text-shadow: var(--lui-text-shadow);
}

.rr__timer {
  min-width: 7ch;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-variant-numeric: tabular-nums;
  color: var(--lui-text-color);
  text-align: right;
  text-shadow: var(--lui-text-shadow);
}

.rr__fauxpad {
  position: absolute;
  bottom: var(--spacing-6);
  left: var(--spacing-6);
  z-index: var(--z-dropdown);
}

.rr__countdown {
  position: absolute;
  top: 40%;
  left: 50%;
  font-family: var(--lui-font);
  font-size: var(--lui-text-important);
  font-weight: 900;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  transform: translate(-50%, -50%) scale(2);
}
</style>
