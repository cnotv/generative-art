<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { MmPlayer } from '@/stores/marbleMadness'
import type { GameMode } from './types'

const props = defineProps<{
  mode: GameMode
  playerList: MmPlayer[]
  winnerId: string | null
  localPeerId: string
  isHost: boolean
  isSolo: boolean
  soloFinalTime: number
  bestTime: number | null
  isNewBest: boolean
  rushDistance: number
  rushBestDistance: number | null
  isNewRushBest: boolean
}>()

const emit = defineEmits<{
  restart: []
  leaveRoom: []
}>()

const formatTime = (seconds: number | null): string => {
  if (seconds === null) return '--:--'
  const total = Math.floor(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const winnerName = (): string => {
  const winner = props.playerList.find((p) => p.id === props.winnerId)
  return winner?.name ?? 'Unknown'
}

const RESTART_KEYS = new Set([
  'w',
  'a',
  's',
  'd',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight'
])
const RESTART_DELAY_MS = 2000

const showPlayAgain = ref(false)
let restartTimer: ReturnType<typeof setTimeout> | null = null

const handlePlayAgain = (): void => {
  emit('restart')
}

const handleEscKey = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') emit('leaveRoom')
}

const handleRestartKey = (event: KeyboardEvent): void => {
  if (!RESTART_KEYS.has(event.key)) return
  window.removeEventListener('keydown', handleRestartKey)
  handlePlayAgain()
}

onMounted(() => {
  if (props.isSolo) {
    window.addEventListener('keydown', handleEscKey)
    restartTimer = setTimeout(() => {
      showPlayAgain.value = true
      window.addEventListener('keydown', handleRestartKey)
      window.addEventListener('touchstart', handlePlayAgain, { once: true })
      restartTimer = null
    }, RESTART_DELAY_MS)
  }
})

onUnmounted(() => {
  if (restartTimer) clearTimeout(restartTimer)
  window.removeEventListener('keydown', handleEscKey)
  window.removeEventListener('keydown', handleRestartKey)
  window.removeEventListener('touchstart', handlePlayAgain)
})
</script>

<template>
  <div class="mm-summary" :class="{ 'mm-summary--solo': isSolo }">
    <template v-if="isSolo && mode === 'rush'">
      <div class="mm-summary__solo-time">{{ rushDistance }}m</div>
      <div v-if="isNewRushBest" class="mm-summary__best mm-summary__best--new">New best!</div>
      <div v-else-if="rushBestDistance !== null" class="mm-summary__best">
        Best: {{ rushBestDistance }}m
      </div>
      <Transition name="mm-summary-fade">
        <div v-if="showPlayAgain" class="mm-summary__move-hint">Move to play again</div>
      </Transition>
      <Transition name="mm-summary-fade">
        <div v-if="showPlayAgain" class="mm-summary__esc-hint">Esc — Settings</div>
      </Transition>
    </template>

    <template v-else-if="isSolo">
      <div class="mm-summary__solo-time">{{ formatTime(soloFinalTime) }}</div>
      <div v-if="isNewBest" class="mm-summary__best mm-summary__best--new">New best!</div>
      <div v-else-if="bestTime !== null" class="mm-summary__best">
        Best: {{ formatTime(bestTime) }}
      </div>
      <Transition name="mm-summary-fade">
        <div v-if="showPlayAgain" class="mm-summary__move-hint">Move to play again</div>
      </Transition>
      <Transition name="mm-summary-fade">
        <div v-if="showPlayAgain" class="mm-summary__esc-hint">Esc — Settings</div>
      </Transition>
    </template>

    <div v-else class="mm-summary__card">
      <div v-if="winnerId !== localPeerId" class="mm-summary__winner-name-wrap">
        <div class="mm-summary__winner-name">{{ winnerName() }}</div>
      </div>
      <h2 class="mm-summary__title">
        {{ winnerId === localPeerId ? 'You win!' : 'Wins!' }}
      </h2>

      <ul class="mm-summary__scores">
        <li
          v-for="(player, index) in playerList"
          :key="player.id"
          class="mm-summary__row"
          :class="{ 'mm-summary__row--winner': player.id === winnerId }"
        >
          <span class="mm-summary__rank">{{ index + 1 }}</span>
          <span class="mm-summary__dot" :style="{ background: player.color }" />
          <span class="mm-summary__name">{{ player.name }}</span>
          <span class="mm-summary__time">
            {{ player.finishTime !== null ? formatTime(player.finishTime) : 'DNF' }}
          </span>
        </li>
      </ul>

      <div class="mm-summary__actions">
        <button
          v-if="isHost"
          class="mm-summary__btn mm-summary__btn--primary"
          type="button"
          @click="emit('restart')"
        >
          Play again
        </button>
        <p v-else class="mm-summary__waiting">Waiting for host to restart…</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mm-summary {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-4);
  pointer-events: none;
  z-index: var(--z-overlay, 100);
  gap: var(--spacing-2);
}

.mm-summary__solo-time {
  font-size: clamp(4rem, 12vw, 8rem);
  font-weight: 900;
  font-family: var(--font-playful);
  color: #fff;
  font-variant-numeric: tabular-nums;
  text-shadow: var(--shadow-text-game-large);
  animation: mm-summary-slide-in 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  line-height: 1;
  text-transform: uppercase;
}

.mm-summary__best {
  font-size: clamp(1.25rem, 3vw, 2rem);
  font-weight: 900;
  font-family: var(--font-playful);
  color: #333;
  text-shadow: var(--shadow-text-game-large);
  animation: mm-summary-slide-in 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.08s both;
}

.mm-summary__best--new {
  color: #ffd700;
  font-size: clamp(1.5rem, 4vw, 2.5rem);
}

.mm-summary__move-hint {
  margin-top: var(--spacing-3);
  font-size: clamp(1rem, 2.5vw, 1.5rem);
  font-weight: 900;
  font-family: var(--font-playful);
  color: #f44;
  text-shadow:
    -2px -2px 0 #fff,
    2px -2px 0 #fff,
    -2px 2px 0 #fff,
    2px 2px 0 #fff,
    -2px 0 0 #fff,
    2px 0 0 #fff,
    0 -2px 0 #fff,
    0 2px 0 #fff,
    0.08em 0.1em 0 #000,
    0.14em 0.17em 0 rgb(0 0 0 / 0.5);
  text-transform: uppercase;
  animation:
    mm-summary-slide-in 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s both,
    mm-hint-pulse 2s ease-in-out 0.75s infinite;
}

.mm-summary__esc-hint {
  margin-top: var(--spacing-2);
  font-size: clamp(0.75rem, 2vw, 1rem);
  font-weight: 700;
  font-family: var(--font-playful);
  color: #fff;
  text-shadow: var(--shadow-text-game);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  animation: mm-summary-slide-in 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.3s both;
}

/* Multiplayer: transparent card with playful type */
.mm-summary__card {
  pointer-events: all;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4, 1.5rem);
  text-align: center;
  animation: mm-summary-slide-in 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

@keyframes mm-summary-slide-in {
  from {
    opacity: 0;
    transform: translateY(60px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes mm-hint-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.45;
  }
}

.mm-summary__winner-name-wrap {
  max-width: 90vw;
  overflow: hidden;
  animation: mm-summary-slide-in 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

.mm-summary__winner-name {
  font-size: clamp(2rem, 8vw, 5rem);
  font-weight: 900;
  font-family: var(--font-playful);
  color: #ffd700;
  text-shadow: var(--shadow-text-game-large);
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
  padding: 0.55em 0.65em;
  margin: -0.55em -0.65em;
}

.mm-summary__title {
  margin: 0;
  font-size: clamp(3rem, 10vw, 6rem);
  font-weight: 900;
  font-family: var(--font-playful);
  color: #ffd700;
  text-shadow: var(--shadow-text-game-large);
  text-transform: uppercase;
  line-height: 1;
}

.mm-summary__scores {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.mm-summary__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
}

.mm-summary__rank {
  font-size: 1.25rem;
  font-weight: 900;
  font-family: var(--font-playful);
  color: #fff;
  text-shadow: var(--shadow-text-game-large);
  min-width: 1.5rem;
  text-align: center;
}

.mm-summary__dot {
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.mm-summary__name {
  flex: 1;
  font-weight: 900;
  font-size: 1.25rem;
  font-family: var(--font-playful);
  color: #fff;
  text-shadow: var(--shadow-text-game-large);
  text-align: left;
}

.mm-summary__time {
  font-weight: 900;
  font-size: 1.25rem;
  font-family: var(--font-playful);
  color: #fff;
  text-shadow: var(--shadow-text-game-large);
  font-variant-numeric: tabular-nums;
}

.mm-summary__row--winner .mm-summary__name,
.mm-summary__row--winner .mm-summary__time,
.mm-summary__row--winner .mm-summary__rank {
  color: #ffd700;
}

.mm-summary__actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: center;
}

.mm-summary__btn {
  padding: var(--spacing-3) var(--spacing-5, 1.5rem);
  border: none;
  background: transparent;
  font-size: clamp(1.25rem, 3vw, 2rem);
  font-weight: 900;
  font-family: var(--font-playful);
  color: #fff;
  text-shadow: var(--shadow-text-game-large);
  cursor: pointer;
  transition: transform 0.1s ease;
  text-transform: uppercase;
}

.mm-summary__btn--primary {
  color: #ffd700;
}

.mm-summary__btn:hover {
  transform: scale(1.08);
}

.mm-summary-fade-enter-active {
  animation: mm-summary-slide-in 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

.mm-summary__waiting {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 900;
  font-family: var(--font-playful);
  color: #fff;
  text-shadow: var(--shadow-text-game-large);
  text-transform: uppercase;
}
</style>
