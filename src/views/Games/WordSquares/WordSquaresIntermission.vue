<script setup lang="ts">
import type { WsPlayer } from '@/stores/wordSquares'

defineProps<{
  roundNumber: number
  totalRounds: number
  word: string
  intermissionLeft: number
  playerList: WsPlayer[]
  solvedPlayers: Record<string, number>
}>()
</script>

<template>
  <section class="ws-intermission">
    <div class="ws-intermission__card">
      <h2 class="ws-intermission__title">Round {{ roundNumber }} over</h2>
      <p class="ws-intermission__word">
        The word was <strong>{{ word }}</strong>
      </p>
      <ul class="ws-intermission__scores">
        <li v-for="player in playerList" :key="player.id" class="ws-intermission__score-row">
          <span class="ws-intermission__score-dot" :style="{ background: player.color }" />
          <span class="ws-intermission__score-name">{{ player.name }}</span>
          <span v-if="solvedPlayers[player.id]" class="ws-intermission__solved">✓ solved</span>
          <span v-else class="ws-intermission__unsolved">✗</span>
          <span class="ws-intermission__score-pts">{{ player.score }} pts</span>
        </li>
      </ul>
      <p v-if="roundNumber < totalRounds" class="ws-intermission__next">
        Next round in {{ intermissionLeft }}s…
      </p>
    </div>
  </section>
</template>

<style scoped>
.ws-intermission {
  grid-area: main;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ws-intermission__card {
  background: #fff;
  border: 3px solid #111;
  border-radius: 1.25rem;
  box-shadow: 5px 5px 0 #111;
  padding: var(--spacing-5, 2rem);
  max-width: 28rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  text-align: center;
}

.ws-intermission__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 900;
  color: #111;
}

.ws-intermission__word {
  margin: 0;
  font-size: 1rem;
  color: #333;
}

.ws-intermission__word strong {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ws-green);
}

.ws-intermission__scores {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.ws-intermission__score-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid #f0f0f0;
  border-radius: 999px;
}

.ws-intermission__score-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 2px solid #111;
  flex-shrink: 0;
}

.ws-intermission__score-name {
  flex: 1;
  font-weight: 700;
  font-size: var(--font-size-sm);
  text-align: left;
}

.ws-intermission__solved {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: #2e7d32;
}

.ws-intermission__unsolved {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: #d32f2f;
}

.ws-intermission__score-pts {
  font-weight: 800;
  font-size: var(--font-size-sm);
  min-width: 3.5rem;
  text-align: right;
}

.ws-intermission__next {
  margin: 0;
  font-size: var(--font-size-sm);
  color: #888;
}
</style>
