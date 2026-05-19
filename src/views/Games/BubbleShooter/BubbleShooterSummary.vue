<script setup lang="ts">
import type { BsPlayer } from '@/stores/bubbleShooter'

defineProps<{
  playerList: BsPlayer[]
  winnerId: string | null
  localPeerId: string
  isHost: boolean
}>()

const emit = defineEmits<{
  restart: []
  leaveRoom: []
}>()
</script>

<template>
  <section class="bs-summary">
    <div class="bs-summary__card">
      <h2 class="bs-summary__title">
        {{ winnerId === localPeerId ? 'You win! 🎉' : 'Game over!' }}
      </h2>

      <ul class="bs-summary__scores">
        <li
          v-for="(player, index) in playerList"
          :key="player.id"
          class="bs-summary__row"
          :class="{ 'bs-summary__row--winner': player.id === winnerId }"
        >
          <span class="bs-summary__rank">{{ index + 1 }}</span>
          <span class="bs-summary__dot" :style="{ background: player.color }" />
          <span class="bs-summary__name">{{ player.name }}</span>
          <span class="bs-summary__pts">{{ player.score }} pts</span>
        </li>
      </ul>

      <div class="bs-summary__actions">
        <button
          v-if="isHost"
          class="bs-summary__btn bs-summary__btn--primary"
          type="button"
          @click="emit('restart')"
        >
          Play again
        </button>
        <p v-else class="bs-summary__waiting">Waiting for host to restart…</p>
        <button class="bs-summary__btn" type="button" @click="emit('leaveRoom')">
          Back to lobby
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bs-summary {
  grid-area: main;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-4);
}

.bs-summary__card {
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

.bs-summary__title {
  margin: 0;
  font-size: 2rem;
  font-weight: 900;
  color: var(--game-ink);
}

.bs-summary__scores {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.bs-summary__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid var(--game-surface-dim);
  border-radius: 999px;
}

.bs-summary__row--winner {
  border-color: var(--bs-accent);
  background: color-mix(in srgb, var(--bs-accent) 10%, transparent);
}

.bs-summary__rank {
  font-size: var(--font-size-sm);
  font-weight: 800;
  color: var(--game-ink-muted);
  min-width: 1.25rem;
  text-align: center;
}

.bs-summary__dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 2px solid var(--game-border);
  flex-shrink: 0;
}

.bs-summary__name {
  flex: 1;
  font-weight: 700;
  font-size: var(--font-size-sm);
  text-align: left;
}

.bs-summary__pts {
  font-weight: 800;
  font-size: var(--font-size-sm);
}

.bs-summary__actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: center;
}

.bs-summary__btn {
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

.bs-summary__btn--primary {
  background: var(--bs-accent);
  color: #fff;
}

.bs-summary__btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--game-border);
}

.bs-summary__waiting {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--game-ink-muted);
}
</style>
