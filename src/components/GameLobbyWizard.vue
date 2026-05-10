<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Check } from 'lucide-vue-next'
import GameCard from '@/components/GameCard.vue'
import { useGameLobby } from '@/composables/useGameLobby'
import { PLAYER_COLORS } from '@/utils/playerProfile'
import type { LobbyConfigField, LobbyPlayer } from '@/types/lobbyWizard'

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: LobbyPlayer[]
  roomId: string
  matchmakerRoom: string
  configFields: LobbyConfigField[]
  accentColor: string
  minPlayers?: number
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  nameChange: []
  configChange: [key: string, value: string | number]
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
}>()

const step = ref(1)
const totalSteps = computed(() => (props.isHost ? 3 : 2))
const required = computed(() => props.minPlayers ?? 2)

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
  getPlayerName: () => props.playerName
})

const handleAccept = (entry: Parameters<typeof acceptRequest>[0]): void => {
  const gameRoomId = acceptRequest(entry)
  if (gameRoomId) emit('matchFound', gameRoomId)
}

const canGoNext = computed(() => {
  if (step.value === 2 && props.isHost) return props.playerList.length >= required.value
  return step.value < totalSteps.value
})

const goNext = (): void => {
  if (step.value < totalSteps.value) step.value++
}

const goBack = (): void => {
  if (step.value > 1) {
    if (step.value === 2 && isSearching.value) stopSearching()
    step.value--
  }
}

const handleFieldChange = (field: LobbyConfigField, event: Event): void => {
  const raw = (event.target as HTMLInputElement | HTMLSelectElement).value
  emit('configChange', field.key, field.type === 'number' ? Number(raw) : raw)
}

watch(
  () => props.isHost,
  (isHost) => {
    if (!isHost) stopSearching()
  }
)
</script>

<template>
  <section class="glw" :style="{ '--glw-accent': accentColor }">
    <GameCard class="glw__card">
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
      </div>

      <!-- Step 2: Matchmaker (host) / Waiting (guest) -->
      <div v-else-if="step === 2" class="glw__body">
        <template v-if="isHost">
          <h3 class="glw__step-title">Find players</h3>
          <div class="glw__players">
            <span class="glw__player-count">
              {{ playerList.length }} /
              {{ playerList.length < required ? `${required}+` : playerList.length }} players
            </span>
            <span
              v-for="player in playerList"
              :key="player.id"
              class="glw__player-dot"
              :style="{ background: player.color }"
              :title="player.name"
            />
          </div>

          <template v-if="!isSearching">
            <p v-if="playerList.length < required" class="glw__hint">No one else here yet.</p>
            <div class="glw__actions">
              <button class="glw__btn" type="button" @click="startSearching">
                Search for players
              </button>
              <button
                v-if="playerList.length >= required"
                class="glw__btn glw__btn--ghost"
                type="button"
                @click="emit('leaveRoom')"
              >
                Leave room
              </button>
            </div>
          </template>

          <template v-else>
            <div class="glw__searching">
              Searching
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
            <div class="glw__actions">
              <button class="glw__btn glw__btn--ghost" type="button" @click="stopSearching">
                Stop searching
              </button>
              <button
                v-if="playerList.length >= required"
                class="glw__btn glw__btn--ghost"
                type="button"
                @click="emit('leaveRoom')"
              >
                Leave room
              </button>
            </div>
          </template>
        </template>

        <template v-else>
          <h3 class="glw__step-title">Waiting for host</h3>
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
          <div class="glw__searching">
            <span class="glw__dots" aria-hidden="true"
              ><span>.</span><span>.</span><span>.</span></span
            >
          </div>
          <button class="glw__btn glw__btn--ghost" type="button" @click="emit('leaveRoom')">
            Leave room
          </button>
        </template>
      </div>

      <!-- Step 3: Settings (host only) -->
      <div v-else-if="step === 3" class="glw__body">
        <h3 class="glw__step-title">Game settings</h3>
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
              <option v-for="opt in field.options" :key="opt.value" :value="opt.value">
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
          :disabled="playerList.length < required"
          @click="emit('startGame')"
        >
          Start
        </button>
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
  min-width: 0;
  max-width: 100%;
}

.glw__card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
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
  background: #ddd;
  border: 2px solid #ccc;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.glw__step-dot--active {
  background: #111;
  border-color: #111;
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
  color: #111;
}

.glw__name-input,
.glw__name-input:focus {
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

.glw__swatches {
  display: flex;
  gap: var(--spacing-1);
  flex-wrap: wrap;
}

.glw__swatch-btn {
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

.glw__swatch-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
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
  color: #111;
}

.glw__player-count {
  flex: 1;
  font-size: var(--font-size-sm);
}

.glw__player-dot {
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  border: 2px solid #111;
  flex-shrink: 0;
}

.glw__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #555;
}

.glw__actions {
  display: flex;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.glw__searching {
  display: flex;
  align-items: baseline;
  gap: 0.1em;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
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
  border: 2px solid #111;
  border-radius: 999px;
  background: #f0fff4;
}

.glw__request-name {
  flex: 1;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
}

.glw__request-actions {
  display: flex;
  gap: var(--spacing-1);
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
  color: #111;
  font-weight: 700;
}

.glw__field select,
.glw__field input {
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid #111;
  border-radius: var(--radius-sm);
  background: #fff;
  color: #111;
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.glw__btn {
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid #111;
  border-radius: 999px;
  background: var(--glw-accent);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 2px 2px 0 #111;
  white-space: nowrap;
  transition: transform 0.1s ease;
  touch-action: manipulation;
  font-family: inherit;
}

.glw__btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.glw__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.glw__btn--ghost {
  background: #fff;
  color: #111;
}

.glw__nav {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding-top: var(--spacing-2);
  border-top: 2px solid #f0f0f0;
}

.glw__nav-spacer {
  flex: 1;
}

.glw__start-btn {
  padding: var(--spacing-2) var(--spacing-5, 1.5rem);
  border: 3px solid #111;
  border-radius: 999px;
  background: var(--glw-accent);
  color: #fff;
  font-size: var(--font-size-md, 1rem);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
  transition: transform 0.1s ease;
  touch-action: manipulation;
  font-family: inherit;
}

.glw__start-btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 #111;
}

.glw__start-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: 2px 2px 0 #111;
}

@media (max-width: 720px) {
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
