<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { MmPlayer } from '@/stores/marbleMadness'

const props = defineProps<{
  playerList: MmPlayer[]
  winnerId: string | null
  localPeerId: string
  isHost: boolean
  isSolo: boolean
  soloFinalTime: number
  bestTime: number | null
  isNewBest: boolean
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

const handlePlayAgain = (): void => {
  emit('restart')
}

onMounted(() => {
  if (props.isSolo) {
    window.addEventListener('keydown', handlePlayAgain, { once: true })
    window.addEventListener('touchstart', handlePlayAgain, { once: true })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handlePlayAgain)
  window.removeEventListener('touchstart', handlePlayAgain)
})
</script>

<template>
  <div class="mm-summary" :class="{ 'mm-summary--solo': isSolo }">
    <template v-if="isSolo">
      <div class="mm-summary__solo-time">{{ formatTime(soloFinalTime) }}</div>
      <div v-if="isNewBest" class="mm-summary__best mm-summary__best--new">New best!</div>
      <div v-else-if="bestTime !== null" class="mm-summary__best">
        Best: {{ formatTime(bestTime) }}
      </div>
      <div class="mm-summary__move-hint">Move to play again</div>
    </template>

    <div v-else class="mm-summary__card">
      <h2 class="mm-summary__title">
        {{ winnerId === localPeerId ? 'You win!' : `${winnerName()} wins!` }}
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
}

/* Solo: no background, just floating text */
.mm-summary--solo {
  gap: var(--spacing-2);
}

.mm-summary__solo-time {
  font-size: clamp(3.5rem, 10vw, 6rem);
  font-weight: 900;
  color: var(--game-ink);
  font-variant-numeric: tabular-nums;
  text-shadow:
    0 2px 12px rgb(0, 0, 0, 0.5),
    0 0 40px rgb(0, 0, 0, 0.2);
  animation: mm-summary-slide-in 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  line-height: 1;
}

.mm-summary__best {
  font-size: var(--font-size-lg, 1.25rem);
  font-weight: 700;
  color: var(--game-ink-muted);
  text-shadow: 0 1px 6px rgb(0, 0, 0, 0.4);
  animation: mm-summary-slide-in 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.08s both;
}

.mm-summary__best--new {
  color: var(--mm-accent);
  font-size: var(--font-size-xl, 1.5rem);
}

.mm-summary__move-hint {
  margin-top: var(--spacing-3);
  font-size: var(--font-size-md, 1rem);
  font-weight: 600;
  color: var(--game-ink-muted);
  text-shadow: 0 1px 4px rgb(0, 0, 0, 0.4);
  animation:
    mm-summary-slide-in 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s both,
    mm-hint-pulse 2s ease-in-out 0.75s infinite;
}

/* Multiplayer: card with slide-in */
.mm-summary__card {
  pointer-events: all;
  background: var(--game-surface-subtle);
  color: var(--game-ink);
  border: 3px solid var(--game-border);
  border-radius: var(--radius-lg, 1.25rem);
  box-shadow: 5px 5px 0 var(--game-border);
  padding: var(--spacing-5, 2rem);
  max-width: 26rem;
  width: 100%;
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

.mm-summary__title {
  margin: 0;
  font-size: 2rem;
  font-weight: 900;
  color: var(--game-ink);
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
  border: 2px solid var(--game-surface-dim);
  border-radius: 999px;
}

.mm-summary__row--winner {
  border-color: var(--mm-accent);
  background: color-mix(in srgb, var(--mm-accent) 10%, transparent);
}

.mm-summary__rank {
  font-size: var(--font-size-sm);
  font-weight: 800;
  color: var(--game-ink-muted);
  min-width: 1.25rem;
  text-align: center;
}

.mm-summary__dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 2px solid var(--game-border);
  flex-shrink: 0;
}

.mm-summary__name {
  flex: 1;
  font-weight: 700;
  font-size: var(--font-size-sm);
  text-align: left;
}

.mm-summary__time {
  font-weight: 800;
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.mm-summary__actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: center;
}

.mm-summary__btn {
  padding: var(--spacing-3) var(--spacing-5, 1.5rem);
  border: 3px solid var(--game-border);
  border-radius: 999px;
  background: transparent;
  color: var(--game-ink);
  font-size: var(--font-size-md, 1rem);
  font-weight: 800;
  cursor: pointer;
  box-shadow: 3px 3px 0 var(--game-border);
  transition: transform 0.1s ease;
  font-family: inherit;
}

.mm-summary__btn--primary {
  background: var(--mm-accent);
  color: #fff;
}

.mm-summary__btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--game-border);
}

.mm-summary__waiting {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--game-ink-muted);
}
</style>
