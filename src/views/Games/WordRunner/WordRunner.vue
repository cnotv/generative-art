<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import '@/assets/styles/lobby-ui.scss'
import { loadGoogleFont, removeGoogleFont } from '@/utils/ui'
import {
  loadProfile,
  randomPick,
  NAME_ADJECTIVES,
  NAME_ANIMALS,
  PLAYER_COLORS
} from '@/utils/playerProfile'
import { useRoomId } from '@/composables/useRoomId'
import { useMultiplayerLobbyHandlers } from '@/composables/useMultiplayerLobbyHandlers'
import { useWordRunnerStore } from '@/stores/wordRunner'
import LobbyLayout from '@/layout/LobbyLayout.vue'
import GameHeader from '@/components/GameHeader.vue'
import MultiplayerSidebar, { type MultiplayerPlayer } from '@/components/MultiplayerSidebar.vue'
import GameTabBar from '@/components/GameTabBar.vue'
import { DEFAULT_LANGUAGE, READY_TIMEOUT_MS } from './config'
import { LANGUAGE_PACKS, packFor } from './levels/languagePacks'
import { loadLanguage, saveLanguage } from './game/languagePreference'
import { unlockedLevelCount } from './game/levelProgress'
import { useWordRunnerSession } from './useWordRunnerSession'
import WordRunnerLobby from './wizard/WordRunnerLobby.vue'
import WordRunnerRules from './wizard/WordRunnerRules.vue'
import WordRunnerRace from './game/WordRunnerRace.vue'
import type { RemoteRival } from './types'

const FONT_KEY = 'word-runner-font'
const LOBBY_UI_FONT = 'https://fonts.googleapis.com/css2?family=Darumadrop+One&display=swap'

const store = useWordRunnerStore()
const { phase, playerList, messages, hostId, levelId, raceSerial, started, solo } =
  storeToRefs(store)

const storedProfile = loadProfile()
const playerName = ref(
  storedProfile?.name ?? `${randomPick(NAME_ADJECTIVES)}${randomPick(NAME_ANIMALS)}`
)
const playerColor = ref(storedProfile?.color ?? randomPick(PLAYER_COLORS))

const languageOptions = LANGUAGE_PACKS.map((pack) => ({
  value: pack.language,
  label: pack.languageName
}))
const language = ref(
  loadLanguage(
    languageOptions.map((option) => option.value),
    DEFAULT_LANGUAGE
  )
)
watch(language, saveLanguage)

// Read again on every return to the lobby, since a race won there opens the next level.
const openLevels = computed(() => {
  const pack = packFor(language.value)
  return phase.value === 'lobby'
    ? pack.levels.slice(0, unlockedLevelCount(pack.language, pack.levels.length))
    : []
})
const levelOptions = computed(() =>
  openLevels.value.map((level) => ({ value: level.id, label: `${level.cefr} · ${level.title}` }))
)
const selectedLevelId = ref('')
// The newest open level is the one to race next, unless another open one was picked.
watch(
  openLevels,
  (levels) => {
    if (levels.length === 0 || levels.some((level) => level.id === selectedLevelId.value)) return
    selectedLevelId.value = levels[levels.length - 1].id
  },
  { immediate: true }
)

const { roomId, resolvedRoomId } = useRoomId()
const session = useWordRunnerSession(
  { name: playerName.value, color: playerColor.value, roomId: resolvedRoomId },
  { onGo: () => store.markStarted() }
)
const { isHost, localPeerId } = session

const inRoom = computed(() => playerList.value.length > 1)
const canRestart = computed(() => solo.value || isHost.value)
const rivals = computed((): RemoteRival[] =>
  playerList.value
    .filter((player) => player.id !== localPeerId.value)
    .map(({ name, color, distance, lane, finishSeconds }) => ({
      name,
      color,
      distance,
      lane,
      finishSeconds
    }))
)

const handleConfigChange = (key: string, value: string | number): void => {
  if (key === 'language') language.value = packFor(String(value)).language
  if (key === 'levelId') selectedLevelId.value = String(value)
}

/** Races a level: alone against the bot, or with everyone in the room. */
const raceLevel = (nextLevelId: string): void => {
  if (solo.value) store.startRace(nextLevelId)
  else session.startRace(nextLevelId)
}

const handleStartGame = (): void => {
  store.solo = !inRoom.value
  raceLevel(selectedLevelId.value)
}

const handleBackToLobby = (): void => {
  if (solo.value) store.phase = 'lobby'
  else session.returnToLobby()
}

const {
  handleNameChange,
  handleColorChange,
  handleMatchFound,
  handleLeaveRoom: leaveRoom
} = useMultiplayerLobbyHandlers(playerName, playerColor, roomId, session)

const handleLeaveRoom = (): void => {
  store.phase = 'lobby'
  leaveRoom()
}

// The host lets the room go once everyone has loaded the course, or once waiting has lasted
// long enough that one slow device should not hold everyone else at the line.
let readyTimer: ReturnType<typeof setTimeout> | undefined
const goOnce = (): void => {
  if (isHost.value && phase.value === 'race' && !started.value) session.go()
}
const handleReady = (): void => {
  if (solo.value) return
  session.markReady()
  if (!isHost.value) return
  clearTimeout(readyTimer)
  readyTimer = setTimeout(goOnce, READY_TIMEOUT_MS)
}
watch(
  () => store.everyoneReady,
  (everyoneReady) => {
    if (everyoneReady) goOnce()
  }
)

const handleProgress = (distance: number, lane: number): void => {
  if (!solo.value) session.broadcastProgress(distance, lane)
}
const handleFinish = (seconds: number): void => {
  if (!solo.value) session.broadcastFinish(seconds)
}

const showSidebar = ref(false)
const lastReadCount = ref(0)
const unreadCount = computed(() => Math.max(0, messages.value.length - lastReadCount.value))
watch([showSidebar, messages], ([open]) => {
  if (open) lastReadCount.value = messages.value.length
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

onMounted(() => {
  store.reset()
  session.init()
  loadGoogleFont(LOBBY_UI_FONT, FONT_KEY)
})

onUnmounted(() => {
  clearTimeout(readyTimer)
  removeGoogleFont(FONT_KEY)
})
</script>

<template>
  <LobbyLayout
    class="word-runner"
    :phase="phase"
    :show-sidebar="showSidebar"
    :sidebar-visible="inRoom"
    :main-placement="phase === 'race' ? 'fill' : 'center'"
    @leave-room="handleLeaveRoom"
  >
    <template #header>
      <GameHeader :phase="phase" back-to="wizard" @back-to-wizard="handleBackToLobby" />
    </template>

    <template #rules>
      <WordRunnerRules />
    </template>

    <WordRunnerLobby
      v-if="phase === 'lobby'"
      :player-name="playerName"
      :player-color="playerColor"
      :is-host="isHost"
      :player-list="playerList"
      :room-id="roomId"
      :language="language"
      :language-options="languageOptions"
      :level-id="selectedLevelId"
      :level-options="levelOptions"
      @update:player-name="playerName = $event"
      @update:player-color="handleColorChange"
      @name-change="handleNameChange"
      @start-game="handleStartGame"
      @match-found="handleMatchFound"
      @leave-room="handleLeaveRoom"
      @config-change="handleConfigChange"
    />
    <WordRunnerRace
      v-else
      :level-id="levelId"
      :race-serial="raceSerial"
      :solo="solo"
      :started="started"
      :can-restart="canRestart"
      :rivals="rivals"
      @ready="handleReady"
      @progress="handleProgress"
      @finish="handleFinish"
      @restart="raceLevel"
      @lobby="handleBackToLobby"
    />

    <template v-if="inRoom" #sidebar>
      <MultiplayerSidebar
        :players="sidebarPlayers"
        :local-peer-id="localPeerId"
        :messages="messages"
        chat-placeholder="Say something…"
        @send="session.broadcastChat($event)"
      />
    </template>

    <template v-if="inRoom" #tabbar>
      <GameTabBar v-model:show-sidebar="showSidebar" :unread-count="unreadCount" />
    </template>
  </LobbyLayout>
</template>

<style scoped>
.word-runner {
  background: var(--lb-bg);
}
</style>
