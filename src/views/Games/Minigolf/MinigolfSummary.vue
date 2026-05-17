<script setup lang="ts">
import type { MgPlayer } from '@/stores/minigolf'
import type { HoleConfig } from './config'

defineProps<{
  playerList: MgPlayer[]
  activeHoles: HoleConfig[]
  isHost: boolean
}>()

const emit = defineEmits<{
  'play-again': []
}>()

const totalScore = (scores: number[]): number => scores.reduce((a, b) => a + b, 0)
</script>

<template>
  <div class="mg-summary">
    <div class="mg-summary__card">
      <h2 class="mg-summary__title">Final Scores</h2>
      <table class="mg-summary__table">
        <thead>
          <tr>
            <th>Player</th>
            <th v-for="(_, n) in activeHoles" :key="n">H{{ n + 1 }}</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="player in playerList" :key="player.id">
            <td>
              <span class="mg-summary__dot" :style="{ background: player.color }" />
              {{ player.name }}
            </td>
            <td v-for="(score, i) in player.scores" :key="i">{{ score }}</td>
            <td class="mg-summary__total">{{ totalScore(player.scores) }}</td>
          </tr>
        </tbody>
      </table>
      <button
        v-if="isHost"
        class="mg-summary__btn mg-summary__btn--primary"
        @click="emit('play-again')"
      >
        Play again
      </button>
      <p v-else class="mg-summary__hint">Waiting for host to restart…</p>
    </div>
  </div>
</template>

<style scoped>
.mg-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
}

.mg-summary__card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-6);
  background: var(--game-surface-subtle);
  border: 3px solid var(--game-border);
  border-radius: 1.25rem;
  box-shadow: 4px 4px 0 var(--game-border);
  width: min(560px, 92%);
  align-items: center;
}

.mg-summary__title {
  font-size: var(--font-size-xl);
  font-weight: 900;
  color: var(--game-ink);
  margin: 0;
}

.mg-summary__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
  color: var(--game-ink);
}

.mg-summary__table th,
.mg-summary__table td {
  padding: var(--spacing-1) var(--spacing-2);
  text-align: center;
  border-bottom: 2px solid var(--game-border);
}

.mg-summary__table td:first-child,
.mg-summary__table th:first-child {
  text-align: left;
}

.mg-summary__dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: var(--spacing-1);
}

.mg-summary__total {
  font-weight: 700;
}

.mg-summary__btn {
  padding: var(--spacing-2) var(--spacing-5);
  border: 3px solid var(--game-border);
  border-radius: 999px;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 var(--game-border);
  transition: transform 0.1s ease;
  font-family: inherit;
}

.mg-summary__btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--game-border);
}

.mg-summary__btn--primary {
  background: var(--mg-yellow);
  color: var(--game-ink);
}

.mg-summary__hint {
  font-size: var(--font-size-sm);
  color: var(--game-ink-muted);
  margin: 0;
}
</style>
