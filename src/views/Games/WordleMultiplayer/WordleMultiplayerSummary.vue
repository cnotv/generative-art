<script setup lang="ts">
import type { WlPlayer } from '@/stores/wordleMultiplayer'

defineProps<{
  playerList: WlPlayer[]
  winnerId: string | null
  isHost: boolean
}>()

const emit = defineEmits<{
  restart: []
}>()
</script>

<template>
  <section class="wl-summary">
    <div class="wl-summary__card">
      <h2 class="wl-summary__title">Game over!</h2>

      <ul class="wl-summary__scores">
        <li
          v-for="(player, index) in playerList"
          :key="player.id"
          class="wl-summary__score-row"
          :class="{ 'wl-summary__score-row--winner': player.id === winnerId }"
        >
          <span class="wl-summary__rank">{{ index + 1 }}</span>
          <span class="wl-summary__score-dot" :style="{ background: player.color }" />
          <span class="wl-summary__score-name">
            {{ player.name }}
            <span v-if="player.id === winnerId" class="wl-summary__crown">👑</span>
          </span>
          <span class="wl-summary__score-pts">{{ player.score }} pts</span>
        </li>
      </ul>

      <button v-if="isHost" class="wl-summary__restart-btn" type="button" @click="emit('restart')">
        Play again
      </button>
      <p v-else class="wl-summary__waiting">Waiting for host to restart…</p>
    </div>
  </section>
</template>

<style scoped>
.wl-summary {
  grid-area: main;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wl-summary__card {
  background: var(--game-surface-subtle);
  border: 3px solid var(--game-border);
  border-radius: 1.25rem;
  box-shadow: 5px 5px 0 var(--game-border);
  padding: var(--spacing-5, 2rem);
  max-width: 28rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4, 1.5rem);
  text-align: center;
}

.wl-summary__title {
  margin: 0;
  font-size: 2rem;
  font-weight: 900;
  color: var(--game-ink);
}

.wl-summary__scores {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.wl-summary__score-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid var(--game-surface-dim);
  border-radius: 999px;
}

.wl-summary__score-row--winner {
  border-color: var(--wl-yellow);
  background: var(--game-msg-system-bg);
}

.wl-summary__rank {
  font-size: var(--font-size-sm);
  font-weight: 800;
  color: var(--game-ink-muted);
  min-width: 1.25rem;
  text-align: center;
}

.wl-summary__score-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 2px solid var(--game-border);
  flex-shrink: 0;
}

.wl-summary__score-name {
  flex: 1;
  font-weight: 700;
  font-size: var(--font-size-sm);
  text-align: left;
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.wl-summary__crown {
  font-size: 1rem;
}

.wl-summary__score-pts {
  font-weight: 800;
  font-size: var(--font-size-sm);
}

.wl-summary__restart-btn {
  padding: var(--spacing-3) var(--spacing-5, 1.5rem);
  border: 3px solid var(--game-border);
  border-radius: 999px;
  background: var(--wl-green);
  color: #fff;
  font-size: var(--font-size-md, 1rem);
  font-weight: 800;
  cursor: pointer;
  box-shadow: 3px 3px 0 var(--game-border);
  transition: transform 0.1s ease;
}

.wl-summary__restart-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--game-border);
}

.wl-summary__waiting {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--game-ink-muted);
}
</style>
