<script lang="ts">
const rememberedSteps = new Map<string, number>()
</script>

<script setup lang="ts">
import { ref, computed, watch, onMounted, useSlots, inject } from 'vue'
import { useRoute } from 'vue-router'
import { Check } from 'lucide-vue-next'
import GameCard from '@/components/GameCard.vue'
import { useGameLobby } from '@/composables/useGameLobby'
import { PLAYER_COLORS } from '@/utils/playerProfile'
import type { LobbyConfigField, LobbyPlayer } from '@/types/lobbyWizard'

const props = withDefaults(
  defineProps<{
    playerName: string
    playerColor: string
    isHost: boolean
    playerList: LobbyPlayer[]
    roomId: string
    matchmakerRoom: string
    configFields: LobbyConfigField[]
    accentColor: string
    showResults?: boolean
    canStart?: boolean
  }>(),
  { canStart: true }
)

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  nameChange: []
  configChange: [key: string, value: string | number]
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
  playAgain: []
}>()

const route = useRoute()
const fromLobby = computed(() => !!route.query.game)

const step = ref(1)
// Host: profile (1) + settings (2). Guest: profile only (1).
const totalSteps = computed(() => (props.isHost ? 2 : 1))

const isPrivate = ref(false)

const {
  isSearching,
  pendingRequests,
  startSearching,
  stopSearching,
  acceptRequest,
  ignoreRequest,
  displayName
} = useGameLobby({
  matchmakerRoom: props.matchmakerRoom,
  getRoomId: () => props.roomId,
  getPlayerName: () => props.playerName,
  onMatchAccepted: () => emit('matchFound', props.roomId)
})

const handleAccept = (entry: Parameters<typeof acceptRequest>[0]): void => {
  const gameRoomId = acceptRequest(entry)
  if (gameRoomId) emit('matchFound', gameRoomId)
}

const canGoNext = computed(() => step.value < totalSteps.value)

const handleStartGame = (): void => {
  rememberedSteps.set(props.matchmakerRoom, totalSteps.value)
  emit('startGame')
}

const goNext = (): void => {
  if (step.value < totalSteps.value) step.value++
}

const goBack = (): void => {
  if (step.value > 1) step.value--
}

const handleFieldChange = (field: LobbyConfigField, event: Event): void => {
  const raw = (event.target as HTMLInputElement | HTMLSelectElement).value
  emit('configChange', field.key, field.type === 'number' ? Number(raw) : raw)
}

const slots = useSlots()
const hasConfig = computed(() => !!slots.config)

const setRoomHidden = inject<((hidden: boolean) => void) | undefined>('setRoomHidden', undefined)

watch(isPrivate, (priv) => {
  setRoomHidden?.(priv)
  if (priv) stopSearching()
  else if (!fromLobby.value) startSearching()
})

watch(
  () => props.isHost,
  (isHost) => {
    if (!isHost) stopSearching()
  }
)

const restoreStep = (): void => {
  const remembered = rememberedSteps.get(props.matchmakerRoom)
  if (remembered !== undefined) step.value = Math.min(remembered, totalSteps.value)
}

const handleLeaveRoom = (): void => {
  rememberedSteps.delete(props.matchmakerRoom)
  emit('leaveRoom')
}

watch(
  () => props.showResults,
  (showResults) => {
    if (!showResults) restoreStep()
  }
)

onMounted(() => {
  if (!props.showResults && !fromLobby.value && !isPrivate.value) startSearching()
  restoreStep()
})
</script>

<template>
  <section class="glw" :style="{ '--glw-accent': accentColor }">
    <GameCard class="glw__card">
      <div v-if="!showResults">
        <div class="glw__steps">
          <span
            v-for="n in totalSteps"
            :key="n"
            class="glw__step-dot"
            :class="{ 'glw__step-dot--active': n === step, 'glw__step-dot--done': n < step }"
          />
        </div>

        <!-- Step 1: Profile -->
        <div v-if="step === 1" class="glw__body">
          <h3 class="glw__step-title">Your profile</h3>
          <input
            :value="playerName"
            type="text"
            maxlength="20"
            class="glw__name-input"
            placeholder="Your name"
            @input="emit('update:playerName', ($event.target as HTMLInputElement).value)"
            @change="emit('nameChange')"
            @blur="emit('nameChange')"
          />
          <div class="glw__swatches">
            <button
              v-for="color in PLAYER_COLORS"
              :key="color"
              class="glw__swatch-btn"
              :class="{ 'glw__swatch-btn--active': playerColor === color }"
              :style="{ background: color }"
              type="button"
              :title="`Pick color ${color}`"
              @click="emit('update:playerColor', color)"
              @touchend.prevent="emit('update:playerColor', color)"
            >
              <Check v-if="playerColor === color" class="glw__swatch-check" />
            </button>
          </div>

          <slot name="profile-extra" />

          <!-- Private toggle — always visible -->
          <label class="glw__private-toggle">
            <input v-model="isPrivate" type="checkbox" class="glw__private-checkbox" />
            <span>Private — only players with the link can join</span>
          </label>

          <!-- Matchmaking status — only when not fromLobby -->
          <template v-if="!fromLobby && !isPrivate">
            <div v-if="isSearching" class="glw__searching">
              Looking for players
              <span class="glw__dots" aria-hidden="true"
                ><span>.</span><span>.</span><span>.</span></span
              >
            </div>
            <ul v-if="pendingRequests.length" class="glw__requests">
              <li
                v-for="entry in pendingRequests"
                :key="entry.request.requestId"
                class="glw__request"
              >
                <span class="glw__request-name"
                  >{{ displayName(entry.fromPeerId) }} wants to play</span
                >
                <div class="glw__request-actions">
                  <button class="glw__btn" type="button" @click="handleAccept(entry)">Join</button>
                  <button
                    class="glw__btn glw__btn--ghost"
                    type="button"
                    @click="ignoreRequest(entry)"
                  >
                    Ignore
                  </button>
                </div>
              </li>
            </ul>
          </template>

          <!-- Guest: waiting for host -->
          <template v-if="!isHost && playerList.length > 1">
            <div class="glw__players">
              <span class="glw__player-count">
                {{ playerList.length }} player{{ playerList.length !== 1 ? 's' : '' }} in room
              </span>
              <span
                v-for="player in playerList"
                :key="player.id"
                class="glw__player-dot"
                :style="{ background: player.color }"
                :title="player.name"
              />
            </div>
            <button class="glw__btn glw__btn--ghost" type="button" @click="handleLeaveRoom">
              Leave room
            </button>
          </template>
        </div>

        <!-- Step 2: Settings (host only) -->
        <div v-else-if="step === 2" class="glw__body">
          <h3 class="glw__step-title">Game settings</h3>
          <slot v-if="hasConfig" name="config" />
          <div class="glw__players">
            <span class="glw__player-count">{{ playerList.length }} players ready</span>
            <span
              v-for="player in playerList"
              :key="player.id"
              class="glw__player-dot"
              :style="{ background: player.color }"
              :title="player.name"
            />
          </div>
          <div class="glw__fields">
            <label v-for="field in configFields" :key="field.key" class="glw__field">
              {{ field.label }}
              <select
                v-if="field.type === 'select'"
                :value="field.value"
                @change="handleFieldChange(field, $event)"
              >
                <option
                  v-for="opt in field.options"
                  :key="opt.value"
                  :value="opt.value"
                  :selected="opt.value === field.value"
                >
                  {{ opt.label }}
                </option>
              </select>
              <input
                v-else
                type="number"
                :value="field.value"
                :min="field.min"
                :max="field.max"
                @input="handleFieldChange(field, $event)"
              />
            </label>
          </div>
        </div>

        <!-- Navigation -->
        <div class="glw__nav">
          <button v-if="step > 1" class="glw__btn glw__btn--ghost" type="button" @click="goBack">
            ← Back
          </button>
          <span class="glw__nav-spacer" />
          <button
            v-if="step < totalSteps"
            class="glw__btn"
            type="button"
            :disabled="!canGoNext"
            @click="goNext"
          >
            Next →
          </button>
          <button
            v-else-if="isHost"
            class="glw__start-btn"
            type="button"
            :disabled="props.canStart === false"
            @click="handleStartGame"
          >
            Start
          </button>
        </div>
      </div>

      <div v-else class="glw__results">
        <slot name="summary" />
        <div class="glw__nav">
          <button class="glw__btn glw__btn--ghost" type="button" @click="handleLeaveRoom">
            ← Leave
          </button>
          <button class="glw__start-btn" type="button" @click="emit('playAgain')">
            Play Again
          </button>
        </div>
      </div>
    </GameCard>
  </section>
</template>

<style scoped>
.glw {
  grid-area: main;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: min(320px, 100%);
  max-width: 100%;
}

.glw__card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  min-width: min(320px, 100%);
  max-width: 28rem;
  width: 100%;
}

.glw__steps {
  display: flex;
  justify-content: center;
  gap: var(--spacing-2);
}

.glw__step-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--game-border-light);
  border: 2px solid var(--game-border-secondary);
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.glw__step-dot--active {
  background: var(--game-ink);
  border-color: var(--game-border);
}

.glw__step-dot--done {
  background: var(--glw-accent);
  border-color: var(--glw-accent);
}

.glw__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.glw__step-title {
  margin: 0;
  font-size: var(--font-size-md, 1rem);
  font-weight: 800;
  color: var(--game-ink);
}

.glw__name-input,
.glw__name-input:focus {
  padding: var(--spacing-2) var(--spacing-3);
  border: 3px solid var(--game-border);
  border-radius: 999px;
  background: var(--game-surface-subtle);
  color: var(--game-ink);
  font-size: var(--font-size-md, 1rem);
  font-weight: 700;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.glw__swatches {
  display: flex;
  gap: var(--spacing-1);
  flex-wrap: wrap;
}

.glw__swatch-btn {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--game-border);
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  box-shadow: 2px 2px 0 var(--game-border);
  transition: transform 0.1s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.glw__swatch-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--game-border);
}

.glw__swatch-check {
  width: 1rem;
  height: 1rem;
  color: #fff;
  stroke-width: 4;
}

.glw__players {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--game-ink);
}

.glw__player-count {
  flex: 1;
  font-size: var(--font-size-sm);
}

.glw__player-dot {
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  border: 2px solid var(--game-border);
  flex-shrink: 0;
}

.glw__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--game-ink-medium);
}

.glw__actions {
  display: flex;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.glw__private-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--game-ink-medium);
  cursor: pointer;
  user-select: none;
}

.glw__private-checkbox {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  accent-color: var(--glw-accent);
  flex-shrink: 0;
}

.glw__searching {
  display: flex;
  align-items: baseline;
  gap: 0.1em;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--game-ink);
}

@keyframes glw-bounce {
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

.glw__dots span {
  display: inline-block;
  animation: glw-bounce 1.2s ease-in-out infinite;
}

.glw__dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.glw__dots span:nth-child(3) {
  animation-delay: 0.4s;
}

.glw__requests {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.glw__request {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid var(--game-border);
  border-radius: 999px;
  background: var(--game-surface-subtle);
}

.glw__request-name {
  flex: 1;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--game-ink);
}

.glw__request-actions {
  display: flex;
  gap: var(--spacing-1);
}

.glw__settings-list {
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2) var(--spacing-4);
}

.glw__settings-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.glw__settings-label {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--game-ink-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.glw__settings-value {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--game-ink);
}

.glw__fields {
  display: flex;
  gap: var(--spacing-3);
  align-items: flex-end;
  flex-wrap: wrap;
}

.glw__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: var(--game-ink);
  font-weight: 700;
}

.glw__field select,
.glw__field input {
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid var(--game-border);
  border-radius: var(--radius-sm);
  background: var(--game-surface-subtle);
  color: var(--game-ink);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.glw__btn {
  padding: var(--spacing-1) var(--spacing-3);
  border: 1px solid var(--game-border-secondary);
  border-radius: 999px;
  background: var(--glw-accent);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: none;
  white-space: nowrap;
  transition:
    transform 0.1s ease,
    opacity 0.1s ease;
  touch-action: manipulation;
  font-family: inherit;
}

.glw__btn:hover:not(:disabled) {
  opacity: 0.88;
}

.glw__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.glw__btn--ghost {
  background: transparent;
  color: var(--game-ink-medium);
  border-color: transparent;
  box-shadow: none;
}

.glw__btn--ghost:hover:not(:disabled) {
  opacity: 1;
  color: var(--game-ink);
  background: var(--game-surface-subtle);
}

.glw__nav {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding-top: var(--spacing-2);
  border-top: 1px solid var(--game-surface-dim);
}

.glw__nav-spacer {
  flex: 1;
}

.glw__start-btn {
  padding: var(--spacing-2) var(--spacing-5, 1.5rem);
  border: 3px solid var(--game-border);
  border-radius: 999px;
  background: var(--glw-accent);
  color: #fff;
  font-size: var(--font-size-md, 1rem);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 var(--game-border);
  transition: transform 0.1s ease;
  touch-action: manipulation;
  font-family: inherit;
}

.glw__start-btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--game-border);
}

.glw__start-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: 2px 2px 0 var(--game-border);
}

.glw__results {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

@media (width <= 720px) {
  .glw__card {
    max-width: 100%;
    box-sizing: border-box;
    padding: var(--spacing-3);
  }

  .glw__fields {
    justify-content: center;
  }
}
</style>
