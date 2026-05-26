<script setup lang="ts">
import type { MmPlayer } from '@/stores/marbleMadness'

const props = defineProps<{
  playerList: MmPlayer[]
  winnerId: string | null
  localPeerId: string
  isHost: boolean
  isSolo: boolean
  elapsedTime: number
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
</script>

<template>
  <section class="mm-summary">
    <div class="mm-summary__card">
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
            {{
              player.finishTime !== null
                ? formatTime(player.finishTime)
                : isSolo
                  ? formatTime(elapsedTime)
                  : 'DNF'
            }}
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
        <button class="mm-summary__btn" type="button" @click="emit('leaveRoom')">
          Back to lobby
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mm-summary {
  grid-area: main;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-4);
}

.mm-summary__card {
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
