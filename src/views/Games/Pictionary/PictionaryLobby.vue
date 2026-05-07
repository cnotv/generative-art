<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { onUnmounted, ref, watch } from 'vue'
import type { DictionaryDifficulty } from '@webgamekit/dictionary'
import type { PictionaryPlayer, PictionaryRound } from '@/stores/pictionary'
import {
  p2pIsSupported,
  p2pLobbyJoin,
  type LobbyHandle,
  type MatchRequest
} from '@webgamekit/multiplayer-p2p'
import {
  PLAYER_COLORS,
  ROUND_DURATION_OPTIONS,
  WORD_COUNT_OPTIONS,
  HINT_COUNT_OPTIONS
} from './constants'

const MATCHMAKER_ROOM = 'pictionary-matchmaker'
const PEER_ID_LENGTH = 8

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: PictionaryPlayer[]
  round: PictionaryRound
  difficulty: DictionaryDifficulty
  totalRounds: number
  roundDuration: number
  wordCount: number
  hintCount: number
  roomId: string
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  'update:difficulty': [value: DictionaryDifficulty]
  'update:totalRounds': [value: number]
  'update:roundDuration': [value: number]
  'update:wordCount': [value: number]
  'update:hintCount': [value: number]
  nameChange: []
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
}>()

const lobbyHandle = ref<LobbyHandle | null>(null)
const pendingRequests = ref<Array<{ request: MatchRequest; fromPeerId: string }>>([])
const peerNames = ref<Record<string, string>>({})

const displayName = (peerId: string): string =>
  peerNames.value[peerId] || peerId.slice(0, PEER_ID_LENGTH)

const stopSearching = (): void => {
  lobbyHandle.value?.stop()
  lobbyHandle.value = null
  pendingRequests.value = []
  peerNames.value = {}
}

const startSearching = (): void => {
  if (!p2pIsSupported() || lobbyHandle.value) return

  const handle = p2pLobbyJoin(MATCHMAKER_ROOM, undefined, {
    onPeerJoin: (peerId) => {
      handle.sendRequest(peerId, props.roomId)
    },
    onPeerLeave: (peerId) => {
      pendingRequests.value = pendingRequests.value.filter((r) => r.fromPeerId !== peerId)
    },
    onRequest: (request, fromPeerId) => {
      if (!pendingRequests.value.some((r) => r.fromPeerId === fromPeerId)) {
        pendingRequests.value = [...pendingRequests.value, { request, fromPeerId }]
      }
    },
    onAccepted: () => {
      // Our request was accepted — the peer is coming to our room. Stay and keep searching.
    },
    onIgnored: () => {},
    onPeerName: (peerId, name) => {
      peerNames.value = { ...peerNames.value, [peerId]: name }
    }
  })

  handle.getPeerIds().forEach((peerId) => handle.sendRequest(peerId, props.roomId))
  handle.setName(props.playerName)
  lobbyHandle.value = handle
}

const acceptRequest = (entry: { request: MatchRequest; fromPeerId: string }): void => {
  if (!lobbyHandle.value) return
  lobbyHandle.value.acceptRequest(entry.request, entry.fromPeerId)
  stopSearching()
  emit('matchFound', entry.request.gameRoomId)
}

const ignoreRequest = (entry: { request: MatchRequest; fromPeerId: string }): void => {
  if (!lobbyHandle.value) return
  lobbyHandle.value.ignoreRequest(entry.request, entry.fromPeerId)
  pendingRequests.value = pendingRequests.value.filter(
    (r) => r.request.requestId !== entry.request.requestId
  )
}

const handleNameInput = (event: Event): void => {
  emit('update:playerName', (event.target as HTMLInputElement).value)
}

watch(
  () => props.isHost,
  (isHost) => {
    if (!isHost) stopSearching()
  }
)

onUnmounted(stopSearching)
</script>

<template>
  <section class="pictionary-lobby">
    <div class="pictionary-lobby__profile">
      <div class="pictionary-lobby__profile-row">
        <h2 class="pictionary-lobby__profile-title">Your name is</h2>
        <input
          :value="playerName"
          type="text"
          maxlength="20"
          class="pictionary-lobby__name-input"
          @input="handleNameInput"
          @change="emit('nameChange')"
          @blur="emit('nameChange')"
        />
        <div class="pictionary-lobby__swatches">
          <button
            v-for="color in PLAYER_COLORS"
            :key="color"
            class="pictionary-lobby__swatch-btn"
            :class="{ 'pictionary-lobby__swatch-btn--active': playerColor === color }"
            :style="{ background: color }"
            type="button"
            :title="`Pick color ${color}`"
            @click="emit('update:playerColor', color)"
          >
            <Check v-if="playerColor === color" class="pictionary-lobby__swatch-check" />
          </button>
        </div>
      </div>
    </div>
    <div class="pictionary-lobby__players">
      <span class="pictionary-lobby__player-count">
        {{ playerList.length }} / {{ playerList.length < 2 ? '2+' : playerList.length }} players
      </span>
      <span
        v-for="player in playerList"
        :key="player.id"
        class="pictionary-lobby__player-dot"
        :style="{ background: player.color }"
        :title="player.name"
      />
    </div>

    <div v-if="isHost" class="pictionary-lobby__matchmaker">
      <template v-if="!lobbyHandle">
        <p v-if="playerList.length <= 1" class="pictionary-lobby__matchmaker-label">
          No one else here yet.
        </p>
        <div class="pictionary-lobby__matchmaker-actions">
          <button class="pictionary-lobby__matchmaker-btn" type="button" @click="startSearching">
            Find players
          </button>
          <button
            v-if="playerList.length > 1"
            class="pictionary-lobby__matchmaker-btn pictionary-lobby__matchmaker-btn--ghost"
            type="button"
            @click="emit('leaveRoom')"
          >
            Leave room
          </button>
        </div>
      </template>

      <template v-else>
        <div class="pictionary-lobby__matchmaker-searching">
          <span>Searching</span>
          <span class="pictionary-lobby__dots" aria-hidden="true">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>

        <ul v-if="pendingRequests.length" class="pictionary-lobby__requests">
          <li
            v-for="entry in pendingRequests"
            :key="entry.request.requestId"
            class="pictionary-lobby__request"
          >
            <span class="pictionary-lobby__request-name">
              {{ displayName(entry.fromPeerId) }} wants to play
            </span>
            <div class="pictionary-lobby__request-actions">
              <button
                class="pictionary-lobby__matchmaker-btn"
                type="button"
                @click="acceptRequest(entry)"
              >
                Join
              </button>
              <button
                class="pictionary-lobby__matchmaker-btn pictionary-lobby__matchmaker-btn--ghost"
                type="button"
                @click="ignoreRequest(entry)"
              >
                Ignore
              </button>
            </div>
          </li>
        </ul>

        <div class="pictionary-lobby__matchmaker-actions">
          <button
            class="pictionary-lobby__matchmaker-btn pictionary-lobby__matchmaker-btn--ghost"
            type="button"
            @click="stopSearching"
          >
            Stop searching
          </button>
          <button
            v-if="playerList.length > 1"
            class="pictionary-lobby__matchmaker-btn pictionary-lobby__matchmaker-btn--ghost"
            type="button"
            @click="emit('leaveRoom')"
          >
            Leave room
          </button>
        </div>
      </template>
    </div>
    <div v-if="isHost" class="pictionary-lobby__host-controls">
      <label class="pictionary-lobby__field">
        Difficulty
        <select
          :value="difficulty"
          @change="
            emit(
              'update:difficulty',
              ($event.target as HTMLSelectElement).value as DictionaryDifficulty
            )
          "
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <label class="pictionary-lobby__field">
        Rounds
        <input
          :value="totalRounds"
          type="number"
          min="1"
          max="20"
          @input="emit('update:totalRounds', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label class="pictionary-lobby__field">
        Round time
        <select
          :value="roundDuration"
          @change="emit('update:roundDuration', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="seconds in ROUND_DURATION_OPTIONS" :key="seconds" :value="seconds">
            {{ seconds }}s
          </option>
        </select>
      </label>
      <label class="pictionary-lobby__field">
        Words
        <select
          :value="wordCount"
          @change="emit('update:wordCount', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="count in WORD_COUNT_OPTIONS" :key="count" :value="count">
            {{ count }}
          </option>
        </select>
      </label>
      <label class="pictionary-lobby__field">
        Hints
        <select
          :value="hintCount"
          @change="emit('update:hintCount', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="count in HINT_COUNT_OPTIONS" :key="count" :value="count">
            {{ count }}
          </option>
        </select>
      </label>
      <button
        class="pictionary-lobby__start-btn"
        type="button"
        :disabled="playerList.length < 2"
        @click="emit('startGame')"
      >
        Start
      </button>
    </div>
    <div v-else class="pictionary-lobby__guest-waiting">
      <span class="pictionary-lobby__matchmaker-searching">
        Waiting for host
        <span class="pictionary-lobby__dots" aria-hidden="true">
          <span>.</span><span>.</span><span>.</span>
        </span>
      </span>
      <button
        class="pictionary-lobby__matchmaker-btn pictionary-lobby__matchmaker-btn--ghost"
        type="button"
        @click="emit('leaveRoom')"
      >
        Leave room
      </button>
    </div>
  </section>
</template>

<style scoped>
.pictionary-lobby {
  grid-area: main;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  align-items: center;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.pictionary-lobby__profile {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  background: #fff;
  border: 3px solid #111;
  border-radius: 1.25rem;
  box-shadow: 4px 4px 0 #111;
  max-width: 28rem;
  width: 100%;
}

.pictionary-lobby__profile-title {
  margin: 0;
  font-size: var(--font-size-md, 1.125rem);
  font-weight: 800;
  color: #111;
  white-space: nowrap;
}

.pictionary-lobby__profile-row {
  display: flex;
  gap: var(--spacing-3);
  align-items: center;
  flex-wrap: wrap;
}

.pictionary-lobby__name-input,
.pictionary-lobby__name-input:focus {
  padding: var(--spacing-2) var(--spacing-3);
  border: 3px solid #111;
  border-radius: 999px;
  background: #fff;
  color: #111;
  font-size: var(--font-size-md, 1rem);
  font-weight: 700;
  min-width: 10rem;
  outline: none;
  flex: 1;
}

.pictionary-lobby__swatches {
  display: flex;
  gap: var(--spacing-1);
  flex-wrap: wrap;
}

.pictionary-lobby__swatch-btn {
  width: 2rem;
  height: 2rem;
  border: 2px solid #111;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  box-shadow: 2px 2px 0 #111;
  transition: transform 0.1s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.pictionary-lobby__swatch-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.pictionary-lobby__swatch-check {
  width: 1rem;
  height: 1rem;
  color: #fff;
  stroke-width: 4;
}

.pictionary-lobby__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: #111;
  font-weight: 700;
}

.pictionary-lobby__field select,
.pictionary-lobby__field input {
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid #111;
  border-radius: var(--radius-sm);
  background: #fff;
  color: #111;
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.pictionary-lobby__hint {
  color: var(--color-muted-foreground);
  font-size: var(--font-size-sm);
}

.pictionary-lobby__players {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
}

.pictionary-lobby__player-count {
  font-size: var(--font-size-sm);
}

.pictionary-lobby__player-dot {
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  border: 2px solid #111;
  display: inline-block;
}

.pictionary-lobby__guest-waiting {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4);
  background: #fff;
  border: 3px solid #111;
  border-radius: 1.25rem;
  box-shadow: 4px 4px 0 #111;
  max-width: 28rem;
  width: 100%;
}

.pictionary-lobby__matchmaker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-4);
  background: #fff;
  border: 3px solid #111;
  border-radius: 1.25rem;
  box-shadow: 4px 4px 0 #111;
  max-width: 28rem;
  width: 100%;
}

.pictionary-lobby__matchmaker-label {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
}

.pictionary-lobby__matchmaker-actions {
  display: flex;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.pictionary-lobby__matchmaker-searching {
  display: flex;
  align-items: baseline;
  gap: 0.1em;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
}

@keyframes pic-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-0.35em);
    opacity: 1;
  }
}

.pictionary-lobby__dots span {
  display: inline-block;
  animation: pic-bounce 1.2s ease-in-out infinite;
}
.pictionary-lobby__dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.pictionary-lobby__dots span:nth-child(3) {
  animation-delay: 0.4s;
}

.pictionary-lobby__requests {
  list-style: none;
  margin: var(--spacing-1) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.pictionary-lobby__request {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid #111;
  border-radius: 999px;
  background: #f0f9ff;
}

.pictionary-lobby__request-name {
  flex: 1;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
}

.pictionary-lobby__request-actions {
  display: flex;
  gap: var(--spacing-1);
}

.pictionary-lobby__matchmaker-btn {
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid #111;
  border-radius: 999px;
  background: var(--pic-blue);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 2px 2px 0 #111;
  white-space: nowrap;
  transition: transform 0.1s ease;
}

.pictionary-lobby__matchmaker-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.pictionary-lobby__matchmaker-btn--ghost {
  background: #fff;
  color: #111;
}

.pictionary-lobby__leave-row {
  max-width: 28rem;
  width: 100%;
  display: flex;
}

.pictionary-lobby__host-controls {
  display: flex;
  gap: var(--spacing-3);
  align-items: flex-end;
}

.pictionary-lobby__start-btn {
  padding: var(--spacing-2) var(--spacing-5, 1.5rem);
  border: 3px solid #111;
  border-radius: 999px;
  background: var(--pic-pink);
  color: #fff;
  font-size: var(--font-size-md, 1rem);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
  transition: transform 0.1s ease;
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
}

.pictionary-lobby__start-btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 #111;
}

.pictionary-lobby__start-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: 2px 2px 0 #111;
}

@media (max-width: 720px) {
  .pictionary-lobby {
    padding-left: 0;
    padding-right: 0;
  }

  .pictionary-lobby__profile {
    max-width: 100%;
    box-sizing: border-box;
    box-shadow: none;
    padding: var(--spacing-2);
  }

  .pictionary-lobby__host-controls {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
