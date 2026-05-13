<script setup lang="ts">
import { computed } from 'vue'
import type { WmPlayer, WmClaimedWord } from '@/stores/squaresMultiplayer'
import { scoreWord } from './squaresMultiplayerUtilities'

const props = defineProps<{
  playerList: WmPlayer[]
  winnerId: string | null
  isHost: boolean
  validWords: string[]
  claimedWords: WmClaimedWord[]
  players: Record<string, { name: string; color: string }>
}>()

const emit = defineEmits<{
  restart: []
}>()

type WordGroup = {
  length: number
  slots: Array<{ word: string; claim: WmClaimedWord | null }>
}

const wordGroups = computed((): WordGroup[] => {
  const grouped = props.validWords.reduce<
    Record<number, Array<{ word: string; claim: WmClaimedWord | null }>>
  >((accumulator, word) => {
    const length_ = word.length
    const claim =
      props.claimedWords.find((cw) => cw.word.toUpperCase() === word.toUpperCase()) ?? null
    return { ...accumulator, [length_]: [...(accumulator[length_] ?? []), { word, claim }] }
  }, {})
  return Object.entries(grouped)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([length, slots]) => ({ length: Number(length), slots }))
})
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

      <div v-if="validWords.length > 0" class="ws-summary__words">
        <h3 class="ws-summary__words-title">Last round words</h3>
        <div v-for="group in wordGroups" :key="group.length" class="ws-summary__word-group">
          <span class="ws-summary__word-group-label">
            {{ group.length }} letters
            <span class="ws-summary__word-group-pts"
              >{{ scoreWord('_'.repeat(group.length)) }}pt</span
            >
          </span>
          <div class="ws-summary__word-slots">
            <div
              v-for="(slot, slotIndex) in group.slots"
              :key="slotIndex"
              class="ws-summary__word-slot"
              :class="slot.claim ? 'ws-summary__word-slot--found' : 'ws-summary__word-slot--missed'"
            >
              <span
                v-if="slot.claim"
                class="ws-summary__word-dot"
                :style="{ background: players[slot.claim.playerId]?.color ?? '#888' }"
              />
              <span class="ws-summary__word-text">{{ slot.word.toLowerCase() }}</span>
            </div>
          </div>
        </div>
      </div>

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
  background: var(--game-surface-subtle);
  color: var(--game-ink);
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

.ws-summary__title {
  margin: 0;
  font-size: 2rem;
  font-weight: 900;
  color: var(--game-ink);
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
  border: 2px solid var(--game-surface-dim);
  border-radius: 999px;
}

.ws-summary__score-row--winner {
  border-color: var(--ws-yellow);
  background: var(--game-msg-system-bg);
}

.ws-summary__rank {
  font-size: var(--font-size-sm);
  font-weight: 800;
  color: var(--game-ink-muted);
  min-width: 1.25rem;
  text-align: center;
}

.ws-summary__score-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 2px solid var(--game-border);
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
  border: 3px solid var(--game-border);
  border-radius: 999px;
  background: var(--ws-green);
  color: #fff;
  font-size: var(--font-size-md, 1rem);
  font-weight: 800;
  cursor: pointer;
  box-shadow: 3px 3px 0 var(--game-border);
  transition: transform 0.1s ease;
}

.ws-summary__restart-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--game-border);
}

.ws-summary__waiting {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--game-ink-muted);
}

.ws-summary__words {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  border-top: 2px solid var(--game-surface-dim);
  padding-top: var(--spacing-3);
}

.ws-summary__words-title {
  margin: 0;
  font-size: var(--font-size-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--game-ink-medium);
}

.ws-summary__word-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.ws-summary__word-group-label {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--game-ink-muted);
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.ws-summary__word-group-pts {
  font-size: var(--font-size-xs);
  font-weight: 700;
  background: var(--ws-green);
  color: #fff;
  border-radius: 999px;
  padding: 0 var(--spacing-1);
}

.ws-summary__word-slots {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1);
}

.ws-summary__word-slot {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid var(--game-border-light);
  border-radius: 999px;
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.ws-summary__word-slot--found {
  background: var(--wm-bg);
  border-color: var(--ws-green);
}

.ws-summary__word-slot--missed {
  opacity: 0.45;
}

.ws-summary__word-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1.5px solid var(--game-border);
}

.ws-summary__word-text {
  color: var(--game-ink);
}
</style>
