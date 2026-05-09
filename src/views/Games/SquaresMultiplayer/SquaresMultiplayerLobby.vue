<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check } from 'lucide-vue-next'
import GameCard from '@/components/GameCard.vue'
import { useGameLobby } from '@/composables/useGameLobby'
import type { DictionaryDifficulty } from '@webgamekit/dictionary'
import type { WmPlayer } from '@/stores/squaresMultiplayer'
import { ROUND_DURATION_OPTIONS, MATCHMAKER_ROOM } from './constants'
import { PLAYER_COLORS } from '@/utils/playerProfile'

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: WmPlayer[]
  roomId: string
  difficulty: DictionaryDifficulty
  totalRounds: number
  roundDuration: number
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  'update:difficulty': [value: DictionaryDifficulty]
  'update:totalRounds': [value: number]
  'update:roundDuration': [value: number]
  nameChange: []
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
}>()

type Section = 'profile' | 'matchmaker' | 'settings'
const openSection = ref<Section | null>(null)

const toggle = (section: Section): void => {
  openSection.value = openSection.value === section ? null : section
}

const {
  isSearching,
  pendingRequests,
  startSearching,
  stopSearching,
  acceptRequest,
  ignoreRequest,
  displayName
} = useGameLobby({
  matchmakerRoom: MATCHMAKER_ROOM,
  getRoomId: () => props.roomId,
  getPlayerName: () => props.playerName
})

const handleAccept = (entry: Parameters<typeof acceptRequest>[0]): void => {
  const gameRoomId = acceptRequest(entry)
  if (gameRoomId) emit('matchFound', gameRoomId)
}

const handleNameInput = (event: Event): void => {
  emit('update:playerName', (event.target as HTMLInputElement).value)
}

const handleNameCommit = (): void => {
  openSection.value = null
  emit('nameChange')
}

const handleStartSearching = (): void => {
  openSection.value = 'matchmaker'
  startSearching()
}

const handleStopSearching = (): void => {
  openSection.value = null
  stopSearching()
}

const handleColorPick = (color: string): void => {
  emit('update:playerColor', color)
}

watch(
  () => props.isHost,
  (isHost) => {
    if (!isHost) stopSearching()
  }
)
</script>

<template>
  <section class="ws-lobby">
    <GameCard class="ws-lobby__card">
      <!-- Profile section -->
      <div class="ws-lobby__section">
        <button class="ws-lobby__section-header" type="button" @click="toggle('profile')">
          <span class="ws-lobby__profile-dot" :style="{ background: playerColor }" />
          <span class="ws-lobby__section-label">{{ playerName || 'Your name' }}</span>
          <span class="ws-lobby__section-chevron">{{ openSection === 'profile' ? '▲' : '▼' }}</span>
        </button>
        <div v-if="openSection === 'profile'" class="ws-lobby__section-body">
          <input
            :value="playerName"
            type="text"
            maxlength="20"
            class="ws-lobby__name-input"
            placeholder="Your name"
            @input="handleNameInput"
            @change="handleNameCommit"
            @blur="handleNameCommit"
          />
          <div class="ws-lobby__swatches">
            <button
              v-for="color in PLAYER_COLORS"
              :key="color"
              class="ws-lobby__swatch-btn"
              :class="{ 'ws-lobby__swatch-btn--active': playerColor === color }"
              :style="{ background: color }"
              type="button"
              :title="`Pick color ${color}`"
              @click="handleColorPick(color)"
              @touchend.prevent="handleColorPick(color)"
            >
              <Check v-if="playerColor === color" class="ws-lobby__swatch-check" />
            </button>
          </div>
        </div>
      </div>

      <!-- Player count row -->
      <div class="ws-lobby__section ws-lobby__section--players">
        <div class="ws-lobby__players">
          <span class="ws-lobby__player-count">
            {{ playerList.length }} / {{ playerList.length < 2 ? '2+' : playerList.length }} players
          </span>
          <span
            v-for="player in playerList"
            :key="player.id"
            class="ws-lobby__player-dot"
            :style="{ background: player.color }"
            :title="player.name"
          />
        </div>
      </div>

      <!-- Matchmaker section (host only) -->
      <template v-if="isHost">
        <div class="ws-lobby__section">
          <button
            class="ws-lobby__section-header"
            type="button"
            @click="isSearching ? handleStopSearching() : toggle('matchmaker')"
          >
            <span class="ws-lobby__section-label">
              <template v-if="isSearching">
                Searching
                <span class="ws-lobby__dots" aria-hidden="true">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </template>
              <template v-else>Find players</template>
            </span>
            <span class="ws-lobby__section-chevron">
              {{ isSearching ? '■' : openSection === 'matchmaker' ? '▲' : '▼' }}
            </span>
          </button>
          <div v-if="openSection === 'matchmaker' || isSearching" class="ws-lobby__section-body">
            <template v-if="!isSearching">
              <p v-if="playerList.length <= 1" class="ws-lobby__hint">No one else here yet.</p>
              <div class="ws-lobby__actions">
                <button class="ws-lobby__btn" type="button" @click="handleStartSearching">
                  Start searching
                </button>
                <button
                  v-if="playerList.length > 1"
                  class="ws-lobby__btn ws-lobby__btn--ghost"
                  type="button"
                  @click="emit('leaveRoom')"
                >
                  Leave room
                </button>
              </div>
            </template>
            <template v-else>
              <ul v-if="pendingRequests.length" class="ws-lobby__requests">
                <li
                  v-for="entry in pendingRequests"
                  :key="entry.request.requestId"
                  class="ws-lobby__request"
                >
                  <span class="ws-lobby__request-name">
                    {{ displayName(entry.fromPeerId) }} wants to play
                  </span>
                  <div class="ws-lobby__request-actions">
                    <button class="ws-lobby__btn" type="button" @click="handleAccept(entry)">
                      Join
                    </button>
                    <button
                      class="ws-lobby__btn ws-lobby__btn--ghost"
                      type="button"
                      @click="ignoreRequest(entry)"
                    >
                      Ignore
                    </button>
                  </div>
                </li>
              </ul>
              <div class="ws-lobby__actions">
                <button
                  class="ws-lobby__btn ws-lobby__btn--ghost"
                  type="button"
                  @click="handleStopSearching"
                >
                  Stop searching
                </button>
                <button
                  v-if="playerList.length > 1"
                  class="ws-lobby__btn ws-lobby__btn--ghost"
                  type="button"
                  @click="emit('leaveRoom')"
                >
                  Leave room
                </button>
              </div>
            </template>
          </div>
        </div>

        <!-- Settings section -->
        <div class="ws-lobby__section" :class="{ 'ws-lobby__section--disabled': isSearching }">
          <button
            class="ws-lobby__section-header"
            type="button"
            :disabled="isSearching"
            @click="toggle('settings')"
          >
            <span class="ws-lobby__section-label">Settings</span>
            <span class="ws-lobby__section-chevron">{{
              openSection === 'settings' ? '▲' : '▼'
            }}</span>
          </button>
          <div v-if="openSection === 'settings' && !isSearching" class="ws-lobby__section-body">
            <div class="ws-lobby__host-controls">
              <label class="ws-lobby__field">
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
              <label class="ws-lobby__field">
                Rounds
                <input
                  :value="totalRounds"
                  type="number"
                  min="1"
                  max="20"
                  @input="
                    emit('update:totalRounds', Number(($event.target as HTMLInputElement).value))
                  "
                />
              </label>
              <label class="ws-lobby__field">
                Round time
                <select
                  :value="roundDuration"
                  @change="
                    emit('update:roundDuration', Number(($event.target as HTMLSelectElement).value))
                  "
                >
                  <option v-for="seconds in ROUND_DURATION_OPTIONS" :key="seconds" :value="seconds">
                    {{ seconds === 0 ? 'No limit' : `${seconds}s` }}
                  </option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <!-- Start button -->
        <div class="ws-lobby__start-row">
          <button
            class="ws-lobby__start-btn"
            type="button"
            :disabled="playerList.length < 2"
            @click="emit('startGame')"
          >
            Start
          </button>
        </div>
      </template>

      <!-- Guest: waiting -->
      <template v-else>
        <div class="ws-lobby__section">
          <div class="ws-lobby__section-body">
            <span class="ws-lobby__searching">
              Waiting for host
              <span class="ws-lobby__dots" aria-hidden="true">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </span>
            <button
              class="ws-lobby__btn ws-lobby__btn--ghost"
              type="button"
              @click="emit('leaveRoom')"
            >
              Leave room
            </button>
          </div>
        </div>
      </template>
    </GameCard>
  </section>
</template>

<style scoped>
.ws-lobby {
  grid-area: main;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  align-items: center;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
}

.ws-lobby__card {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  max-width: 28rem;
  width: 100%;
  overflow: hidden;
}

/* Accordion sections */
.ws-lobby__section {
  border-bottom: 2px solid #f0f0f0;
}

.ws-lobby__section:last-child {
  border-bottom: none;
}

.ws-lobby__section--disabled {
  opacity: 0.45;
  pointer-events: none;
}

.ws-lobby__section--players {
  padding: var(--spacing-2) var(--spacing-4);
}

.ws-lobby__section-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-4);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  user-select: none;
  touch-action: manipulation;
}

.ws-lobby__section-header:disabled {
  cursor: not-allowed;
}

.ws-lobby__section-label {
  flex: 1;
  font-size: var(--font-size-sm);
  font-weight: 800;
  color: #111;
  display: flex;
  align-items: baseline;
  gap: 0.1em;
}

.ws-lobby__section-chevron {
  font-size: var(--font-size-xs);
  color: #888;
}

.ws-lobby__section-body {
  padding: 0 var(--spacing-4) var(--spacing-3);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

/* Profile */
.ws-lobby__profile-dot {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 2px solid #111;
  flex-shrink: 0;
}

.ws-lobby__name-input,
.ws-lobby__name-input:focus {
  padding: var(--spacing-2) var(--spacing-3);
  border: 3px solid #111;
  border-radius: 999px;
  background: #fff;
  color: #111;
  font-size: var(--font-size-md, 1rem);
  font-weight: 700;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.ws-lobby__swatches {
  display: flex;
  gap: var(--spacing-1);
  flex-wrap: wrap;
}

.ws-lobby__swatch-btn {
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
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.ws-lobby__swatch-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.ws-lobby__swatch-check {
  width: 1rem;
  height: 1rem;
  color: #fff;
  stroke-width: 4;
}

/* Players */
.ws-lobby__players {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
}

.ws-lobby__player-count {
  flex: 1;
  font-size: var(--font-size-sm);
}

.ws-lobby__player-dot {
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  border: 2px solid #111;
  display: inline-block;
  flex-shrink: 0;
}

/* Matchmaker */
.ws-lobby__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
}

.ws-lobby__actions {
  display: flex;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.ws-lobby__searching {
  display: flex;
  align-items: baseline;
  gap: 0.1em;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
}

@keyframes ws-bounce {
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

.ws-lobby__dots span {
  display: inline-block;
  animation: ws-bounce 1.2s ease-in-out infinite;
}
.ws-lobby__dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.ws-lobby__dots span:nth-child(3) {
  animation-delay: 0.4s;
}

.ws-lobby__requests {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.ws-lobby__request {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid #111;
  border-radius: 999px;
  background: #f0fff4;
}

.ws-lobby__request-name {
  flex: 1;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
}

.ws-lobby__request-actions {
  display: flex;
  gap: var(--spacing-1);
}

.ws-lobby__btn {
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid #111;
  border-radius: 999px;
  background: var(--ws-green);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 2px 2px 0 #111;
  white-space: nowrap;
  transition: transform 0.1s ease;
  touch-action: manipulation;
}

.ws-lobby__btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.ws-lobby__btn--ghost {
  background: #fff;
  color: #111;
}

/* Host controls */
.ws-lobby__host-controls {
  display: flex;
  gap: var(--spacing-3);
  align-items: flex-end;
  flex-wrap: wrap;
}

.ws-lobby__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: #111;
  font-weight: 700;
}

.ws-lobby__field select,
.ws-lobby__field input {
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid #111;
  border-radius: var(--radius-sm);
  background: #fff;
  color: #111;
  font-size: var(--font-size-sm);
  font-weight: 600;
}

/* Start button row */
.ws-lobby__start-row {
  padding: var(--spacing-3) var(--spacing-4) var(--spacing-4);
}

.ws-lobby__start-btn {
  padding: var(--spacing-2) var(--spacing-5, 1.5rem);
  border: 3px solid #111;
  border-radius: 999px;
  background: var(--ws-green);
  color: #fff;
  font-size: var(--font-size-md, 1rem);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
  transition: transform 0.1s ease;
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  touch-action: manipulation;
}

.ws-lobby__start-btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 #111;
}

.ws-lobby__start-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: 2px 2px 0 #111;
}

@media (max-width: 720px) {
  .ws-lobby__card {
    max-width: 100%;
    box-sizing: border-box;
  }

  .ws-lobby__host-controls {
    justify-content: center;
  }
}
</style>
