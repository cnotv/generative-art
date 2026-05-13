<script setup lang="ts">
import type { WlPlayer, GuessRow } from '@/stores/wordleMultiplayer'

defineProps<{
  roundNumber: number
  totalRounds: number
  word: string
  playerGuesses: Record<string, GuessRow[]>
  solvedPlayers: Record<string, number>
  intermissionLeft: number
  playerList: WlPlayer[]
}>()
</script>

<template>
  <section class="wl-intermission">
    <div class="wl-intermission__card">
      <h2 class="wl-intermission__title">Round {{ roundNumber }} over</h2>
      <p class="wl-intermission__word">
        The word was <strong>{{ word.toLowerCase() }}</strong>
      </p>

      <ul class="wl-intermission__players">
        <li v-for="player in playerList" :key="player.id" class="wl-intermission__player-row">
          <div class="wl-intermission__player-header">
            <span class="wl-intermission__player-dot" :style="{ background: player.color }" />
            <span class="wl-intermission__player-name">{{ player.name }}</span>
            <span v-if="solvedPlayers[player.id]" class="wl-intermission__player-solved">✓</span>
            <span v-else class="wl-intermission__player-failed">✗</span>
            <span class="wl-intermission__player-score">{{ player.score }} pts</span>
          </div>
          <div v-if="playerGuesses[player.id]?.length" class="wl-intermission__mini-grid">
            <div
              v-for="(row, rowIndex) in playerGuesses[player.id]"
              :key="rowIndex"
              class="wl-intermission__mini-row"
            >
              <span
                v-for="(status, colIndex) in row.result"
                :key="colIndex"
                class="wl-intermission__mini-tile"
                :class="`wl-intermission__mini-tile--${status}`"
              />
            </div>
          </div>
        </li>
      </ul>

      <p v-if="roundNumber < totalRounds" class="wl-intermission__next">
        Next round in {{ intermissionLeft }}s…
      </p>
    </div>
  </section>
</template>

<style scoped>
.wl-intermission {
  grid-area: main;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wl-intermission__card {
  background: var(--game-surface-subtle);
  border: 3px solid var(--game-border);
  border-radius: 1.25rem;
  box-shadow: 5px 5px 0 var(--game-border);
  padding: var(--spacing-5, 2rem);
  max-width: 32rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  text-align: center;
}

.wl-intermission__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 900;
  color: var(--game-ink);
}

.wl-intermission__word {
  margin: 0;
  font-size: var(--font-size-md, 1rem);
  color: var(--game-ink-medium);
}

.wl-intermission__players {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.wl-intermission__player-row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid var(--game-surface-dim);
  border-radius: var(--radius-sm);
}

.wl-intermission__player-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.wl-intermission__player-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 2px solid var(--game-border);
  flex-shrink: 0;
}

.wl-intermission__player-name {
  flex: 1;
  font-weight: 700;
  font-size: var(--font-size-sm);
  text-align: left;
}

.wl-intermission__player-solved {
  color: #2e7d32;
  font-weight: 900;
}

.wl-intermission__player-failed {
  color: #d32f2f;
  font-weight: 900;
}

.wl-intermission__player-score {
  font-weight: 800;
  font-size: var(--font-size-sm);
  min-width: 3.5rem;
  text-align: right;
}

.wl-intermission__mini-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
}

.wl-intermission__mini-row {
  display: flex;
  gap: 2px;
}

.wl-intermission__mini-tile {
  width: 1rem;
  height: 1rem;
  border-radius: 2px;
  background: var(--game-border-secondary);
}

.wl-intermission__mini-tile--correct {
  background: var(--wl-green);
}

.wl-intermission__mini-tile--present {
  background: var(--wl-yellow);
}

.wl-intermission__mini-tile--absent {
  background: var(--game-ink-muted);
}

.wl-intermission__next {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--game-ink-muted);
}
</style>
