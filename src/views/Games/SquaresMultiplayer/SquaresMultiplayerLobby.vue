<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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

const step = ref(1)
const totalSteps = computed(() => (props.isHost ? 3 : 2))

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
  emit('nameChange')
}

const handleColorPick = (color: string): void => {
  emit('update:playerColor', color)
}

const goNext = (): void => {
  if (step.value < totalSteps.value) step.value++
}

const goBack = (): void => {
  if (step.value > 1) {
    if (step.value === 2 && isSearching.value) stopSearching()
    step.value--
  }
}

const canGoNext = computed(() => {
  if (step.value === 2 && props.isHost) return props.playerList.length >= 2
  return step.value < totalSteps.value
})

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
      <!-- Step indicator -->
      <div class="ws-lobby__steps">
        <span
          v-for="n in totalSteps"
          :key="n"
          class="ws-lobby__step-dot"
          :class="{
            'ws-lobby__step-dot--active': n === step,
            'ws-lobby__step-dot--done': n < step
          }"
        />
      </div>

      <!-- Step 1: Profile -->
      <div v-if="step === 1" class="ws-lobby__body">
        <h3 class="ws-lobby__step-title">Your profile</h3>
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

      <!-- Step 2: Matchmaker (host) / Waiting (guest) -->
      <div v-else-if="step === 2" class="ws-lobby__body">
        <!-- Host -->
        <template v-if="isHost">
          <h3 class="ws-lobby__step-title">Find players</h3>

          <div class="ws-lobby__players">
            <span class="ws-lobby__player-count">
              {{ playerList.length }} / {{ playerList.length < 2 ? '2+' : playerList.length }}
              players
            </span>
            <span
              v-for="player in playerList"
              :key="player.id"
              class="ws-lobby__player-dot"
              :style="{ background: player.color }"
              :title="player.name"
            />
          </div>

          <template v-if="!isSearching">
            <p v-if="playerList.length <= 1" class="ws-lobby__hint">No one else here yet.</p>
            <div class="ws-lobby__actions">
              <button class="ws-lobby__btn" type="button" @click="startSearching">
                Search for players
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
            <div class="ws-lobby__searching">
              Searching
              <span class="ws-lobby__dots" aria-hidden="true">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>

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
                @click="stopSearching"
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
        </template>

        <!-- Guest -->
        <template v-else>
          <h3 class="ws-lobby__step-title">Waiting for host</h3>
          <div class="ws-lobby__players">
            <span class="ws-lobby__player-count">
              {{ playerList.length }} player{{ playerList.length !== 1 ? 's' : '' }} in room
            </span>
            <span
              v-for="player in playerList"
              :key="player.id"
              class="ws-lobby__player-dot"
              :style="{ background: player.color }"
              :title="player.name"
            />
          </div>
          <div class="ws-lobby__searching">
            <span class="ws-lobby__dots" aria-hidden="true">
              <span>.</span><span>.</span><span>.</span>
            </span>
          </div>
          <button
            class="ws-lobby__btn ws-lobby__btn--ghost"
            type="button"
            @click="emit('leaveRoom')"
          >
            Leave room
          </button>
        </template>
      </div>

      <!-- Step 3: Settings (host only) -->
      <div v-else-if="step === 3" class="ws-lobby__body">
        <h3 class="ws-lobby__step-title">Game settings</h3>
        <div class="ws-lobby__players">
          <span class="ws-lobby__player-count"> {{ playerList.length }} players ready </span>
          <span
            v-for="player in playerList"
            :key="player.id"
            class="ws-lobby__player-dot"
            :style="{ background: player.color }"
            :title="player.name"
          />
        </div>
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
              @input="emit('update:totalRounds', Number(($event.target as HTMLInputElement).value))"
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

      <!-- Navigation -->
      <div class="ws-lobby__nav">
        <button
          v-if="step > 1"
          class="ws-lobby__btn ws-lobby__btn--ghost"
          type="button"
          @click="goBack"
        >
          ← Back
        </button>
        <span class="ws-lobby__nav-spacer" />
        <button
          v-if="step < totalSteps"
          class="ws-lobby__btn"
          type="button"
          :disabled="!canGoNext"
          @click="goNext"
        >
          Next →
        </button>
        <button
          v-else-if="isHost"
          class="ws-lobby__start-btn"
          type="button"
          :disabled="playerList.length < 2"
          @click="emit('startGame')"
        >
          Start
        </button>
      </div>
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
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  max-width: 28rem;
  width: 100%;
}

/* Step indicator */
.ws-lobby__steps {
  display: flex;
  justify-content: center;
  gap: var(--spacing-2);
}

.ws-lobby__step-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #ddd;
  border: 2px solid #ccc;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.ws-lobby__step-dot--active {
  background: #111;
  border-color: #111;
}

.ws-lobby__step-dot--done {
  background: var(--ws-green);
  border-color: var(--ws-green);
}

/* Step body */
.ws-lobby__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.ws-lobby__step-title {
  margin: 0;
  font-size: var(--font-size-md, 1rem);
  font-weight: 800;
  color: #111;
}

/* Profile */
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
  color: #555;
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

.ws-lobby__btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.ws-lobby__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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

/* Navigation bar */
.ws-lobby__nav {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding-top: var(--spacing-2);
  border-top: 2px solid #f0f0f0;
}

.ws-lobby__nav-spacer {
  flex: 1;
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
    padding: var(--spacing-3);
  }

  .ws-lobby__host-controls {
    justify-content: center;
  }
}
</style>
