<script setup lang="ts">
import type { WsPlayer } from '@/stores/wordSquares'

defineProps<{
  playerList: WsPlayer[]
  winnerId: string | null
  isHost: boolean
}>()

const emit = defineEmits<{
  restart: []
}>()
</script>

<template>
  <section class="ws-summary">
    <div class="ws-summary__card">
      <h2 class="ws-summary__title">Game over!</h2>

      <ul class="ws-summary__scores">
        <li
          v-for="(player, index) in playerList"
          :key="player.id"
          class="ws-summary__score-row"
          :class="{ 'ws-summary__score-row--winner': player.id === winnerId }"
        >
          <span class="ws-summary__rank">{{ index + 1 }}</span>
          <span class="ws-summary__score-dot" :style="{ background: player.color }" />
          <span class="ws-summary__score-name">
            {{ player.name }}
            <span v-if="player.id === winnerId" class="ws-summary__crown">👑</span>
          </span>
          <span class="ws-summary__score-pts">{{ player.score }} pts</span>
        </li>
      </ul>

      <button v-if="isHost" class="ws-summary__restart-btn" type="button" @click="emit('restart')">
        Play again
      </button>
      <p v-else class="ws-summary__waiting">Waiting for host to restart…</p>
    </div>
  </section>
</template>

<style scoped>
.ws-summary {
  grid-area: main;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ws-summary__card {
  background: #fff;
  border: 3px solid #111;
  border-radius: 1.25rem;
  box-shadow: 5px 5px 0 #111;
  padding: var(--spacing-5, 2rem);
  max-width: 28rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4, 1.5rem);
  text-align: center;
}

.ws-summary__title {
  margin: 0;
  font-size: 2rem;
  font-weight: 900;
  color: #111;
}

.ws-summary__scores {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.ws-summary__score-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid #f0f0f0;
  border-radius: 999px;
}

.ws-summary__score-row--winner {
  border-color: var(--ws-yellow);
  background: #fffbe6;
}

.ws-summary__rank {
  font-size: var(--font-size-sm);
  font-weight: 800;
  color: #888;
  min-width: 1.25rem;
  text-align: center;
}

.ws-summary__score-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 2px solid #111;
  flex-shrink: 0;
}

.ws-summary__score-name {
  flex: 1;
  font-weight: 700;
  font-size: var(--font-size-sm);
  text-align: left;
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.ws-summary__crown {
  font-size: 1rem;
}

.ws-summary__score-pts {
  font-weight: 800;
  font-size: var(--font-size-sm);
}

.ws-summary__restart-btn {
  padding: var(--spacing-3) var(--spacing-5, 1.5rem);
  border: 3px solid #111;
  border-radius: 999px;
  background: var(--ws-green);
  color: #fff;
  font-size: var(--font-size-md, 1rem);
  font-weight: 800;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
  transition: transform 0.1s ease;
}

.ws-summary__restart-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 #111;
}

.ws-summary__waiting {
  margin: 0;
  font-size: var(--font-size-sm);
  color: #888;
}
</style>
