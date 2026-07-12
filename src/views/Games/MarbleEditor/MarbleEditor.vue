<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import * as THREE from 'three'
import { storeToRefs } from 'pinia'
import { useMarbleEditorStore } from '@/stores/marbleEditor'
import { useRoomId } from '@/composables/useRoomId'
import { useMultiplayerLobbyHandlers } from '@/composables/useMultiplayerLobbyHandlers'
import {
  loadProfile,
  randomPick,
  NAME_ADJECTIVES,
  NAME_ANIMALS,
  PLAYER_COLORS
} from '@/utils/playerProfile'
import LobbyLayout from '@/layout/LobbyLayout.vue'
import GameHeader from '@/components/GameHeader.vue'
import MultiplayerSidebar, { type MultiplayerPlayer } from '@/components/MultiplayerSidebar.vue'
import GameTabBar from '@/components/GameTabBar.vue'
import { useMarbleEditor } from './useMarbleEditor'
import { useMarbleRace } from './useMarbleRace'
import { useMarbleEditorSession } from './useMarbleEditorSession'
import EditorPalette from './EditorPalette.vue'
import MarbleEditorLobby from './MarbleEditorLobby.vue'
import MarbleEditorSummary from './MarbleEditorSummary.vue'
import { SAMPLE_MAPS } from './sampleMaps'
import { MARBLE_OPTIONS, DEFAULT_MARBLE } from '../MarbleMadness/config'
import type { CameraMode, MePhase } from './types'

const CAMERA_MODES: { value: CameraMode; label: string; tooltip: string }[] = [
  { value: 'third', label: 'Third', tooltip: 'Follow the marble from behind (press C to cycle)' },
  { value: 'first', label: 'First', tooltip: 'View from the marble (press C to cycle)' },
  { value: 'free', label: 'Free', tooltip: 'Free orbit camera (press C to cycle)' }
]

const store = useMarbleEditorStore()
const { phase, playerList, messages, hostId, raceStartTime } = storeToRefs(store)

const storedProfile = loadProfile()
const playerName = ref(
  storedProfile?.name ?? `${randomPick(NAME_ADJECTIVES)}${randomPick(NAME_ANIMALS)}`
)
const playerColor = ref(storedProfile?.color ?? randomPick(PLAYER_COLORS))
const playerMarble = ref(DEFAULT_MARBLE.id)
const startMode = ref<Extract<MePhase, 'edit' | 'race'>>('edit')

const { roomId, resolvedRoomId } = useRoomId()

const editorCanvas = ref<HTMLCanvasElement | null>(null)
const raceCanvas = ref<HTMLCanvasElement | null>(null)

const marbleUrlById = (id: string): string | undefined =>
  MARBLE_OPTIONS.find((option) => option.id === id)?.url

const marbleUrl = computed(() => marbleUrlById(playerMarble.value) ?? DEFAULT_MARBLE.url)

const editor = useMarbleEditor({
  canvas: editorCanvas,
  onMapChange: (map) => session.broadcastMap({ map })
})

const session = useMarbleEditorSession(
  {
    name: playerName.value,
    color: playerColor.value,
    marble: playerMarble.value,
    roomId: resolvedRoomId
  },
  {
    onMapReceived: (map) => editor.setMapFromRemote(map),
    getCurrentMap: () => editor.currentMap.value,
    onBallPos: (peerId, pos) => {
      const player = store.players[peerId]
      if (!player) return
      race.updateGhostPosition({
        peerId,
        colorHex: new THREE.Color(player.color).getHex(),
        pos,
        texture: marbleUrlById(player.marble),
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

const race = useMarbleRace({
  canvas: raceCanvas,
  map: editor.currentMap,
  marbleTexture: marbleUrl,
  raceStartTime,
  localPlayerName: playerName,
  localPlayerColor: playerColor,
  spawnGateCount,
  spawnGateIndex,
  onPositionUpdate: (pos) => {
    if (!store.solo) session.broadcastBallPos(pos)
  },
  onFinish: (time) => {
    store.setFinishTime(localId(), time)
    if (!store.winnerId) store.winnerId = localId()
    if (!store.solo) session.broadcastFinish(time)
    store.phase = 'summary'
  }
})

const formattedTime = computed(() => {
  const total = race.elapsed.value
  const minutes = Math.floor(total / 60)
  const seconds = (total % 60).toFixed(1).padStart(4, '0')
  return `${minutes}:${seconds}`
})

const mapOptions = computed(() => {
  const all = [...SAMPLE_MAPS, ...editor.savedMaps.value]
  return all.map((map, index) => ({ value: index, label: map.name }))
})
const selectedMapIndex = ref(0)

const handleConfigChange = (key: string, value: string | number): void => {
  if (key !== 'mapIndex') return
  selectedMapIndex.value = Number(value)
  const all = [...SAMPLE_MAPS, ...editor.savedMaps.value]
  const map = all[selectedMapIndex.value]
  if (map) editor.loadMap(map)
}

const upsertLocalPlayer = (): void => {
  store.upsertPlayer({
    id: localId(),
    name: playerName.value,
    color: playerColor.value,
    marble: playerMarble.value,
    finishTime: null
  })
}

const handleStartGame = (): void => {
  store.solo = playerList.value.length <= 1
  upsertLocalPlayer()
  if (startMode.value === 'edit') {
    session.returnToEdit()
  } else {
    session.startRace()
  }
}

const startRaceFromEditor = (): void => {
  store.solo = playerList.value.length <= 1
  upsertLocalPlayer()
  session.startRace()
}

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

const layoutReference = ref<{ requestLeave: () => void } | null>(null)

const handleLeaveRoom = (): void => {
  store.solo = false
  leaveRoom()
}

const requestLeave = (): void => {
  layoutReference.value?.requestLeave() ?? handleLeaveRoom()
}

const canRestart = computed(() => store.solo || isHost.value)

const handleRestart = (): void => {
  session.restartRace()
}

const handleBackToEditor = (): void => {
  session.returnToEdit()
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
    score: player.finishTime !== null ? Math.floor(player.finishTime) : 0,
    isHost: player.id === hostId.value
  }))
)

watch(phase, async (newPhase, oldPhase) => {
  if (newPhase === 'edit') {
    race.destroy()
    await nextTick()
    await editor.init()
    return
  }
  if (newPhase === 'race') {
    editor.destroy()
    if (oldPhase === 'race' || oldPhase === 'summary') race.destroy()
    await nextTick()
    await race.init()
    return
  }
  if (newPhase === 'lobby') {
    editor.destroy()
    race.destroy()
  }
})

onMounted(() => {
  store.reset()
  session.init()
})
</script>

<template>
  <LobbyLayout
    ref="layoutReference"
    class="me"
    :phase="phase"
    :show-sidebar="showSidebar"
    :sidebar-visible="!store.solo"
    :main-placement="phase !== 'lobby' ? 'fill' : 'center'"
    @leave-room="handleLeaveRoom"
  >
    <template #header>
      <GameHeader />
    </template>

    <template #rules>
      <ul>
        <li>Build a track by snapping pieces together: ramps, curves, funnels, loops and jumps</li>
        <li>Click a placed piece to select it, recolor it or remove it</li>
        <li>Everyone in the room edits the same track live</li>
        <li>
          Press Play to race: roll with <strong>WASD</strong> or arrow keys, first to the gold
          finish wins
        </li>
        <li>Press <strong>C</strong> to switch first person, third person and free cameras</li>
      </ul>
    </template>

    <MarbleEditorLobby
      v-if="phase === 'lobby'"
      :player-name="playerName"
      :player-color="playerColor"
      :player-marble="playerMarble"
      :is-host="isHost"
      :player-list="playerList"
      :room-id="roomId"
      :start-mode="startMode"
      :map-options="mapOptions"
      :selected-map-index="selectedMapIndex"
      @update:player-name="playerName = $event"
      @update:player-color="handleColorChange"
      @name-change="handleNameChange"
      @start-game="handleStartGame"
      @match-found="handleMatchFound"
      @leave-room="handleLeaveRoom"
      @config-change="handleConfigChange"
      @marble-change="handleMarbleChange"
      @mode-change="startMode = $event"
    />

    <div v-else class="me__play-area">
      <template v-if="phase === 'edit'">
        <canvas ref="editorCanvas" class="me__canvas"></canvas>
        <EditorPalette
          class="me__palette"
          :selected-piece="editor.selectedPiece.value"
          :saved-maps="editor.savedMaps.value"
          :map-name="editor.currentMap.value.name"
          @add="editor.addPiece"
          @preview="editor.previewPiece"
          @recolor="editor.recolorSelectedPiece"
          @delete-piece="editor.removeSelectedPiece"
          @save-as="editor.saveMapAsName"
          @load-map="editor.loadMap"
          @delete-map="editor.deleteMapByName"
          @new-map="editor.startNewMap"
          @play="startRaceFromEditor"
        />
      </template>

      <template v-else>
        <canvas ref="raceCanvas" class="me__canvas"></canvas>
        <div class="me__hud">
          <span class="me__timer">{{ formattedTime }}</span>
          <span v-if="race.penaltyCount.value > 0" class="me__penalties">
            Falls: {{ race.penaltyCount.value }}
          </span>
          <div class="me__camera-group" role="group" aria-label="Camera mode">
            <button
              v-for="mode in CAMERA_MODES"
              :key="mode.value"
              class="me__hud-button"
              :class="{ 'me__hud-button--active': race.cameraMode.value === mode.value }"
              :title="mode.tooltip"
              @click="race.setCameraMode(mode.value)"
            >
              {{ mode.label }}
            </button>
          </div>
          <button
            v-if="canRestart"
            class="me__hud-button"
            title="Return to the track editor"
            @click="handleBackToEditor"
          >
            Back to editor
          </button>
          <button class="me__hud-button" title="Leave the room" @click="requestLeave">Leave</button>
        </div>
        <div v-if="race.countdown.value > 0" class="me__countdown">
          {{ race.countdown.value }}
        </div>
        <MarbleEditorSummary
          v-if="phase === 'summary'"
          :player-list="playerList"
          :local-peer-id="localId()"
          :can-restart="canRestart"
          @restart="handleRestart"
          @back="handleBackToEditor"
        />
      </template>
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
.me {
  background: var(--lb-bg);
}

.me__play-area {
  position: relative;
  width: 100%;
  height: 100%;
}

.me__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.me__palette {
  position: absolute;
  top: var(--spacing-4);
  left: var(--spacing-4);
  max-height: calc(100% - 2 * var(--spacing-4));
}

.me__hud {
  position: absolute;
  top: var(--spacing-4);
  left: 50%;
  display: flex;
  gap: var(--spacing-4);
  align-items: center;
  padding: var(--spacing-2) var(--spacing-4);
  color: var(--color-foreground);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  transform: translateX(-50%);
}

.me__timer {
  font-size: var(--font-size-lg);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.me__penalties {
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.me__hud-button {
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  cursor: pointer;
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.me__hud-button:hover {
  background: var(--color-accent);
}

.me__hud-button--active {
  color: var(--color-primary-foreground);
  background: var(--color-primary);
}

.me__camera-group {
  display: flex;
  gap: var(--spacing-1);
}

.me__countdown {
  position: absolute;
  top: 40%;
  left: 50%;
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-foreground);
  text-shadow: 0 0 12px var(--color-background);
  transform: translate(-50%, -50%) scale(3);
}
</style>
