<script setup lang="ts">
import { watch } from 'vue'
import { Check } from 'lucide-vue-next'
import GameCard from '@/components/GameCard.vue'
import { useGameLobby } from '@/composables/useGameLobby'
import type { DictionaryDifficulty } from '@webgamekit/dictionary'
import type { WlPlayer } from '@/stores/wordleMultiplayer'
import { ROUND_DURATION_OPTIONS, MATCHMAKER_ROOM } from './constants'
import { PLAYER_COLORS } from '@/utils/playerProfile'

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: WlPlayer[]
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

watch(
  () => props.isHost,
  (isHost) => {
    if (!isHost) stopSearching()
  }
)
</script>

<template>
  <section class="wl-lobby">
    <GameCard class="wl-lobby__profile">
      <div class="wl-lobby__profile-row">
        <h2 class="wl-lobby__profile-title">Your name is</h2>
        <input
          :value="playerName"
          type="text"
          maxlength="20"
          class="wl-lobby__name-input"
          @input="handleNameInput"
          @change="emit('nameChange')"
          @blur="emit('nameChange')"
        />
        <div class="wl-lobby__swatches">
          <button
            v-for="color in PLAYER_COLORS"
            :key="color"
            class="wl-lobby__swatch-btn"
            :class="{ 'wl-lobby__swatch-btn--active': playerColor === color }"
            :style="{ background: color }"
            type="button"
            :title="`Pick color ${color}`"
            @click="emit('update:playerColor', color)"
          >
            <Check v-if="playerColor === color" class="wl-lobby__swatch-check" />
          </button>
        </div>
      </div>
    </GameCard>

    <div class="wl-lobby__players">
      <span class="wl-lobby__player-count">
        {{ playerList.length }} / {{ playerList.length < 2 ? '2+' : playerList.length }} players
      </span>
      <span
        v-for="player in playerList"
        :key="player.id"
        class="wl-lobby__player-dot"
        :style="{ background: player.color }"
        :title="player.name"
      />
    </div>

    <GameCard v-if="isHost" class="wl-lobby__matchmaker">
      <template v-if="!isSearching">
        <p v-if="playerList.length <= 1" class="wl-lobby__matchmaker-label">
          No one else here yet.
        </p>
        <div class="wl-lobby__matchmaker-actions">
          <button class="wl-lobby__matchmaker-btn" type="button" @click="startSearching">
            Find players
          </button>
          <button
            v-if="playerList.length > 1"
            class="wl-lobby__matchmaker-btn wl-lobby__matchmaker-btn--ghost"
            type="button"
            @click="emit('leaveRoom')"
          >
            Leave room
          </button>
        </div>
      </template>

      <template v-else>
        <div class="wl-lobby__matchmaker-searching">
          <span>Searching</span>
          <span class="wl-lobby__dots" aria-hidden="true">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>

        <ul v-if="pendingRequests.length" class="wl-lobby__requests">
          <li
            v-for="entry in pendingRequests"
            :key="entry.request.requestId"
            class="wl-lobby__request"
          >
            <span class="wl-lobby__request-name">
              {{ displayName(entry.fromPeerId) }} wants to play
            </span>
            <div class="wl-lobby__request-actions">
              <button class="wl-lobby__matchmaker-btn" type="button" @click="handleAccept(entry)">
                Join
              </button>
              <button
                class="wl-lobby__matchmaker-btn wl-lobby__matchmaker-btn--ghost"
                type="button"
                @click="ignoreRequest(entry)"
              >
                Ignore
              </button>
            </div>
          </li>
        </ul>

        <div class="wl-lobby__matchmaker-actions">
          <button
            class="wl-lobby__matchmaker-btn wl-lobby__matchmaker-btn--ghost"
            type="button"
            @click="stopSearching"
          >
            Stop searching
          </button>
          <button
            v-if="playerList.length > 1"
            class="wl-lobby__matchmaker-btn wl-lobby__matchmaker-btn--ghost"
            type="button"
            @click="emit('leaveRoom')"
          >
            Leave room
          </button>
        </div>
      </template>
    </GameCard>

    <div v-if="isHost" class="wl-lobby__host-controls">
      <label class="wl-lobby__field">
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
      <label class="wl-lobby__field">
        Rounds
        <input
          :value="totalRounds"
          type="number"
          min="1"
          max="20"
          @input="emit('update:totalRounds', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label class="wl-lobby__field">
        Round time
        <select
          :value="roundDuration"
          @change="emit('update:roundDuration', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="seconds in ROUND_DURATION_OPTIONS" :key="seconds" :value="seconds">
            {{ seconds === 0 ? 'No limit' : `${seconds}s` }}
          </option>
        </select>
      </label>
      <button
        class="wl-lobby__start-btn"
        type="button"
        :disabled="playerList.length < 2"
        @click="emit('startGame')"
      >
        Start
      </button>
    </div>

    <GameCard v-else class="wl-lobby__guest-waiting">
      <span class="wl-lobby__matchmaker-searching">
        Waiting for host
        <span class="wl-lobby__dots" aria-hidden="true">
          <span>.</span><span>.</span><span>.</span>
        </span>
      </span>
      <button
        class="wl-lobby__matchmaker-btn wl-lobby__matchmaker-btn--ghost"
        type="button"
        @click="emit('leaveRoom')"
      >
        Leave room
      </button>
    </GameCard>
  </section>
</template>

<style scoped>
.wl-lobby {
  grid-area: main;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  align-items: center;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
}

.wl-lobby__profile {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  max-width: 28rem;
  width: 100%;
}

.wl-lobby__profile-title {
  margin: 0;
  font-size: var(--font-size-md, 1.125rem);
  font-weight: 800;
  color: #111;
  white-space: nowrap;
}

.wl-lobby__profile-row {
  display: flex;
  gap: var(--spacing-3);
  align-items: center;
  flex-wrap: wrap;
}

.wl-lobby__name-input,
.wl-lobby__name-input:focus {
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

.wl-lobby__swatches {
  display: flex;
  gap: var(--spacing-1);
  flex-wrap: wrap;
}

.wl-lobby__swatch-btn {
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

.wl-lobby__swatch-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.wl-lobby__swatch-check {
  width: 1rem;
  height: 1rem;
  color: #fff;
  stroke-width: 4;
}

.wl-lobby__players {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
}

.wl-lobby__player-count {
  font-size: var(--font-size-sm);
}

.wl-lobby__player-dot {
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  border: 2px solid #111;
  display: inline-block;
}

.wl-lobby__matchmaker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-4);
  max-width: 28rem;
  width: 100%;
}

.wl-lobby__guest-waiting {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4);
  max-width: 28rem;
  width: 100%;
}

.wl-lobby__matchmaker-label {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
}

.wl-lobby__matchmaker-actions {
  display: flex;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.wl-lobby__matchmaker-searching {
  display: flex;
  align-items: baseline;
  gap: 0.1em;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
}

@keyframes wl-bounce {
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

.wl-lobby__dots span {
  display: inline-block;
  animation: wl-bounce 1.2s ease-in-out infinite;
}

.wl-lobby__dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.wl-lobby__dots span:nth-child(3) {
  animation-delay: 0.4s;
}

.wl-lobby__requests {
  list-style: none;
  margin: var(--spacing-1) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.wl-lobby__request {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid #111;
  border-radius: 999px;
  background: #f0fff4;
}

.wl-lobby__request-name {
  flex: 1;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
}

.wl-lobby__request-actions {
  display: flex;
  gap: var(--spacing-1);
}

.wl-lobby__matchmaker-btn {
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid #111;
  border-radius: 999px;
  background: var(--wl-green);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 2px 2px 0 #111;
  white-space: nowrap;
  transition: transform 0.1s ease;
}

.wl-lobby__matchmaker-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.wl-lobby__matchmaker-btn--ghost {
  background: #fff;
  color: #111;
}

.wl-lobby__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: #111;
  font-weight: 700;
}

.wl-lobby__field select,
.wl-lobby__field input {
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid #111;
  border-radius: var(--radius-sm);
  background: #fff;
  color: #111;
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.wl-lobby__host-controls {
  display: flex;
  gap: var(--spacing-3);
  align-items: flex-end;
}

.wl-lobby__start-btn {
  padding: var(--spacing-2) var(--spacing-5, 1.5rem);
  border: 3px solid #111;
  border-radius: 999px;
  background: var(--wl-green);
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

.wl-lobby__start-btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 #111;
}

.wl-lobby__start-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: 2px 2px 0 #111;
}

@media (max-width: 720px) {
  .wl-lobby {
    padding-left: 0;
    padding-right: 0;
  }

  .wl-lobby__profile,
  .wl-lobby__matchmaker,
  .wl-lobby__guest-waiting {
    max-width: 100%;
    box-sizing: border-box;
    padding: var(--spacing-2);
  }

  .wl-lobby__host-controls {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
