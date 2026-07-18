<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as THREE from 'three'
import { loadGoogleFont, removeGoogleFont } from '@/utils/ui'
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
import '@/assets/styles/lobby-ui.scss'
import LobbyLayout from '@/layout/LobbyLayout.vue'
import GameHeader from '@/components/GameHeader.vue'
import MultiplayerSidebar, { type MultiplayerPlayer } from '@/components/MultiplayerSidebar.vue'
import GameTabBar from '@/components/GameTabBar.vue'
import { LobbyUIButton, LobbyUIKeyPill, LobbyUIFocusHint } from '@/components/LobbyUI'
import { useMenuFocus } from '@/composables/useMenuFocus'
import { EDITOR_MENU_MAPPING } from './config'
import { useMarbleEditor } from './useMarbleEditor'
import { useMarbleRace } from './useMarbleRace'
import { useMarbleEditorSession } from './useMarbleEditorSession'
import EditorPalette from './EditorPalette.vue'
import EditorToolbar from './EditorToolbar.vue'
import MarbleEditorLobby from './MarbleEditorLobby.vue'
import MarbleEditorSummary from './MarbleEditorSummary.vue'
import { SAMPLE_MAPS } from './sampleMaps'
import { MARBLE_OPTIONS, DEFAULT_MARBLE } from '../MarbleMadness/config'
import type { CameraMode, MePhase } from './types'

const CAMERA_MODE_LABELS: Record<CameraMode, string> = {
  third: 'Third',
  first: 'First',
  free: 'Free'
}

const store = useMarbleEditorStore()
const { phase, playerList, messages, hostId, raceStartTime } = storeToRefs(store)

const CONFIG_STORAGE_KEY = 'marble-editor-lobby-config'

type StoredLobbyConfig = {
  marble?: string
  mapName?: string
  startMode?: string
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
const playerMarble = ref(
  MARBLE_OPTIONS.some((option) => option.id === storedLobbyConfig.marble)
    ? (storedLobbyConfig.marble as string)
    : DEFAULT_MARBLE.id
)
const startMode = ref<Extract<MePhase, 'edit' | 'race'>>(
  storedLobbyConfig.startMode === 'race' ? 'race' : 'edit'
)

const { roomId, resolvedRoomId } = useRoomId()

const editorCanvas = ref<HTMLCanvasElement | null>(null)
const raceCanvas = ref<HTMLCanvasElement | null>(null)

const marbleUrlById = (id: string): string | undefined =>
  MARBLE_OPTIONS.find((option) => option.id === id)?.url

const marbleUrl = computed(() => marbleUrlById(playerMarble.value) ?? DEFAULT_MARBLE.url)

const editor = useMarbleEditor({
  canvas: editorCanvas,
  onMapChange: (map) => session.broadcastMap({ map }),
  onPlay: () => startRaceFromEditor(),
  onSave: () => editor.saveMapAsName(editor.currentMap.value.name),
  onNewTrack: () => {
    namingNewTrack.value = true
  }
})

const editOverlayReference = ref<HTMLElement | null>(null)
const { focusedHint, inputSource } = useMenuFocus(
  editOverlayReference,
  () => phase.value !== 'edit',
  EDITOR_MENU_MAPPING
)

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
  onBack: () => {
    if (canRestart.value) handleBackToEditor()
  },
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

const allMaps = computed(() => [...SAMPLE_MAPS, ...editor.savedMaps.value])

const mapOptions = computed(() =>
  allMaps.value.map((map, index) => ({ value: index, label: map.name }))
)

const storedMapIndex = allMaps.value.findIndex((map) => map.name === storedLobbyConfig.mapName)
const selectedMapIndex = ref(Math.max(0, storedMapIndex))

const persistLobbyConfig = (): void => {
  localStorage.setItem(
    CONFIG_STORAGE_KEY,
    JSON.stringify({
      marble: playerMarble.value,
      startMode: startMode.value,
      mapName: allMaps.value[selectedMapIndex.value]?.name
    })
  )
}

const handleConfigChange = (key: string, value: string | number): void => {
  if (key !== 'mapIndex') return
  selectedMapIndex.value = Number(value)
  const map = allMaps.value[selectedMapIndex.value]
  if (map) editor.loadMap(map)
  persistLobbyConfig()
}

const handleStartModeChange = (mode: Extract<MePhase, 'edit' | 'race'>): void => {
  startMode.value = mode
  persistLobbyConfig()
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
  persistLobbyConfig()
}

const handleLeaveRoom = (): void => {
  store.solo = false
  store.phase = 'lobby'
  leaveRoom()
}

const canRestart = computed(() => store.solo || isHost.value)

const cameraLabel = computed(() => CAMERA_MODE_LABELS[race.cameraMode.value])

const namingNewTrack = ref(false)

const handleCreateTrack = (name: string): void => {
  editor.startNewMap(name)
  namingNewTrack.value = false
}

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

const ME_FONT_KEY = 'me-font'

onMounted(() => {
  store.reset()
  session.init()
  loadGoogleFont(
    'https://fonts.googleapis.com/css2?family=Darumadrop+One&display=swap',
    ME_FONT_KEY
  )
})

onUnmounted(() => {
  removeGoogleFont(ME_FONT_KEY)
})
</script>

<template>
  <LobbyLayout
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
        <li>
          Undo and redo edits with <strong>Z</strong>/<strong>Y</strong> or
          <strong>L1</strong>/<strong>R1</strong> on a gamepad
        </li>
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
      @mode-change="handleStartModeChange"
    />

    <div v-else class="me__play-area">
      <template v-if="phase === 'edit'">
        <canvas ref="editorCanvas" class="me__canvas"></canvas>
        <div ref="editOverlayReference" class="me__edit-overlay">
          <EditorToolbar
            class="me__topbar"
            data-lui-row
            :can-undo="editor.canUndo.value"
            :can-redo="editor.canRedo.value"
            :saved-maps="editor.savedMaps.value"
            :map-name="editor.currentMap.value.name"
            :naming="namingNewTrack"
            @undo="editor.undo"
            @redo="editor.redo"
            @new-map="namingNewTrack = true"
            @play="startRaceFromEditor"
            @save-as="editor.saveMapAsName"
            @load-map="editor.loadMap"
            @delete-map="editor.deleteMapByName"
            @create-track="handleCreateTrack"
            @cancel-naming="namingNewTrack = false"
          />
          <EditorPalette
            class="me__sidebar"
            :selected-piece="editor.selectedPiece.value"
            @add="editor.addPiece"
            @preview="editor.previewPiece"
            @recolor="editor.recolorSelectedPiece"
            @delete-piece="editor.removeSelectedPiece"
          />
        </div>
        <LobbyUIFocusHint :hint="focusedHint" :visible="inputSource === 'gamepad'" />
      </template>

      <template v-else>
        <canvas ref="raceCanvas" class="me__canvas"></canvas>
        <div class="me__hud">
          <span class="me__timer">{{ formattedTime }}</span>
          <span v-if="race.penaltyCount.value > 0" class="me__penalties">
            Falls: {{ race.penaltyCount.value }}
          </span>
          <LobbyUIButton
            size="sm"
            variant="ghost"
            :title="`Camera: ${cameraLabel} — click or press C to cycle`"
            @click="race.cycleCameraMode"
          >
            Cam: {{ cameraLabel }}
            <LobbyUIKeyPill :keyboard="['C']" :gamepad="['△']" />
          </LobbyUIButton>
          <LobbyUIButton
            v-if="canRestart"
            size="sm"
            variant="ghost"
            title="Return to the track editor"
            @click="handleBackToEditor"
          >
            Back to editor
          </LobbyUIButton>
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

/* Named overlay regions: the top bar row and the sidebar column are grid
   areas, so they can never overlap each other or drift over one another. */
.me__edit-overlay {
  position: absolute;
  inset: 0;
  z-index: var(--z-dropdown);
  display: grid;
  grid-template-areas:
    'topbar topbar'
    'sidebar scene';
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  pointer-events: none;
}

.me__topbar {
  grid-area: topbar;
  justify-self: center;
  pointer-events: auto;
}

.me__sidebar {
  grid-area: sidebar;
  min-height: 0;
  pointer-events: auto;
}

.me__hud {
  position: absolute;
  top: var(--spacing-4);
  left: 50%;
  z-index: var(--z-dropdown);
  display: flex;
  gap: var(--spacing-4);
  align-items: center;
  transform: translateX(-50%);
}

.me__timer {
  font-family: var(--lui-font);
  font-size: var(--lui-text-medium);
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.me__penalties {
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.me__countdown {
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
