<script setup lang="ts">
import { computed } from 'vue'
import { getGrade } from './rhythmGameUtilities'
import type { RgPlayer } from '@/stores/rhythmGame'

const props = defineProps<{
  playerList: RgPlayer[]
  winnerId: string | null
  localPeerId: string
  isHost: boolean
  resultsOnly?: boolean
}>()

const emit = defineEmits<{
  restart: []
  leaveRoom: []
}>()

const localPlayer = computed(() => props.playerList.find((p) => p.id === props.localPeerId))

const accuracy = computed(() => {
  const p = localPlayer.value
  if (!p) return 1
  const total = p.perfect + p.good + p.miss
  if (total === 0) return 1
  return (p.perfect + p.good * 0.5) / total
})

const grade = computed(() => getGrade(accuracy.value))

const gradeColor = computed(() => {
  const map: Record<string, string> = {
    S: '#ffd740',
    A: '#69ff47',
    B: '#00e5ff',
    C: '#ff4081',
    D: '#888'
  }
  return map[grade.value] ?? '#888'
})

const isWinner = computed(() => props.winnerId === props.localPeerId)
</script>

<template>
  <div class="rg-summary" :class="{ 'rg-summary--flat': resultsOnly }">
    <div class="rg-summary__card" :class="{ 'rg-summary__card--flat': resultsOnly }">
      <div class="rg-summary__grade" :style="{ color: gradeColor }">{{ grade }}</div>

      <div v-if="winnerId" class="rg-summary__result">
        {{ isWinner ? '🏆 You win!' : 'Nice try!' }}
      </div>

      <div class="rg-summary__stats">
        <div class="rg-summary__stat">
          <span class="rg-summary__stat-label">Score</span>
          <span class="rg-summary__stat-value">{{
            (localPlayer?.score ?? 0).toLocaleString()
          }}</span>
        </div>
        <div class="rg-summary__stat">
          <span class="rg-summary__stat-label">Max Combo</span>
          <span class="rg-summary__stat-value">{{ localPlayer?.maxCombo ?? 0 }}</span>
        </div>
        <div class="rg-summary__stat">
          <span class="rg-summary__stat-label">Accuracy</span>
          <span class="rg-summary__stat-value">{{ (accuracy * 100).toFixed(1) }}%</span>
        </div>
        <div class="rg-summary__stat">
          <span class="rg-summary__stat-label rg-summary__stat-label--perfect">Perfect</span>
          <span class="rg-summary__stat-value">{{ localPlayer?.perfect ?? 0 }}</span>
        </div>
        <div class="rg-summary__stat">
          <span class="rg-summary__stat-label rg-summary__stat-label--good">Good</span>
          <span class="rg-summary__stat-value">{{ localPlayer?.good ?? 0 }}</span>
        </div>
        <div class="rg-summary__stat">
          <span class="rg-summary__stat-label rg-summary__stat-label--miss">Miss</span>
          <span class="rg-summary__stat-value">{{ localPlayer?.miss ?? 0 }}</span>
        </div>
      </div>

      <div v-if="playerList.length > 1" class="rg-summary__leaderboard">
        <div
          v-for="player in playerList"
          :key="player.id"
          class="rg-summary__row"
          :class="{ 'rg-summary__row--local': player.id === localPeerId }"
        >
          <span class="rg-summary__player-dot" :style="{ background: player.color }" />
          <span class="rg-summary__player-name">{{ player.name }}</span>
          <span class="rg-summary__player-score">{{ player.score.toLocaleString() }}</span>
        </div>
      </div>

      <div v-if="!resultsOnly" class="rg-summary__actions">
        <button
          v-if="isHost"
          class="rg-summary__btn rg-summary__btn--primary"
          type="button"
          @click="emit('restart')"
        >
          Play again
        </button>
        <button class="rg-summary__btn" type="button" @click="emit('leaveRoom')">
          Back to lobby
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rg-summary {
  grid-area: main;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-4);
}

.rg-summary--flat {
  padding: 0;
}

.rg-summary__card {
  background: rgba(255, 255, 255, 0.04);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg, 1.25rem);
  padding: var(--spacing-5);
  max-width: 26rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  align-items: center;
  text-align: center;
}

.rg-summary__card--flat {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
}

.rg-summary__grade {
  font-size: 5rem;
  font-weight: 900;
  line-height: 1;
  text-shadow: 0 0 30px currentColor;
}

.rg-summary__result {
  font-size: var(--font-size-lg, 1.25rem);
  font-weight: 700;
  color: var(--game-ink);
}

.rg-summary__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-2) var(--spacing-4);
  width: 100%;
}

.rg-summary__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rg-summary__stat-label {
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.4);
}

.rg-summary__stat-label--perfect {
  color: #ffd740;
}
.rg-summary__stat-label--good {
  color: #69ff47;
}
.rg-summary__stat-label--miss {
  color: #ff4081;
}

.rg-summary__stat-value {
  font-size: var(--font-size-md, 1rem);
  font-weight: 900;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.rg-summary__leaderboard {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  width: 100%;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: var(--spacing-3);
}

.rg-summary__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
}

.rg-summary__row--local {
  background: rgba(255, 255, 255, 0.06);
}

.rg-summary__player-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.rg-summary__player-name {
  flex: 1;
  font-size: var(--font-size-sm);
  color: rgba(255, 255, 255, 0.8);
  text-align: left;
}

.rg-summary__player-score {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.rg-summary__actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  width: 100%;
}

.rg-summary__btn {
  padding: var(--spacing-2) var(--spacing-4);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s ease;
}

.rg-summary__btn:hover {
  border-color: rgba(255, 255, 255, 0.5);
  color: #fff;
}

.rg-summary__btn--primary {
  background: var(--rg-accent);
  border-color: var(--rg-accent);
  color: #000;
}

.rg-summary__btn--primary:hover {
  filter: brightness(1.1);
}
</style>
