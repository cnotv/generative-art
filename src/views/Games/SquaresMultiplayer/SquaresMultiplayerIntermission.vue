<script setup lang="ts">
import { computed } from 'vue'
import type { WmPlayer, WmClaimedWord } from '@/stores/squaresMultiplayer'

const props = defineProps<{
  roundNumber: number
  totalRounds: number
  validWords: string[]
  claimedWords: WmClaimedWord[]
  intermissionLeft: number
  playerList: WmPlayer[]
  players: Record<string, { name: string; color: string }>
}>()

type WordSlot = { word: string; claim: WmClaimedWord | null }
type WordGroup = { length: number; slots: WordSlot[]; foundCount: number }

const wordGroups = computed((): WordGroup[] => {
  const grouped = props.validWords.reduce<Record<number, WordSlot[]>>((accumulator, word) => {
    const length_ = word.length
    const claim =
      props.claimedWords.find((cw) => cw.word.toUpperCase() === word.toUpperCase()) ?? null
    return { ...accumulator, [length_]: [...(accumulator[length_] ?? []), { word, claim }] }
  }, {})
  return Object.entries(grouped)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([length, slots]) => ({
      length: Number(length),
      slots,
      foundCount: slots.filter((s) => s.claim !== null).length
    }))
})
</script>

<template>
  <section class="wm-intermission">
    <div class="wm-intermission__card">
      <h2 class="wm-intermission__title">Round {{ roundNumber }} over</h2>

      <div v-if="wordGroups.length > 0" class="wm-intermission__groups">
        <div v-for="group in wordGroups" :key="group.length" class="wm-intermission__group">
          <span class="wm-intermission__group-label">
            {{ group.length }} letters
            <span class="wm-intermission__group-count"
              >{{ group.foundCount }}/{{ group.slots.length }}</span
            >
          </span>
          <div class="wm-intermission__group-slots">
            <div
              v-for="(slot, slotIndex) in group.slots"
              :key="slotIndex"
              class="wm-intermission__slot"
              :class="slot.claim ? 'wm-intermission__slot--found' : 'wm-intermission__slot--missed'"
            >
              <span
                v-if="slot.claim"
                class="wm-intermission__slot-dot"
                :style="{ background: players[slot.claim.playerId]?.color ?? '#888' }"
              />
              <span class="wm-intermission__slot-word">{{ slot.word.toLowerCase() }}</span>
            </div>
          </div>
        </div>
      </div>

      <ul class="wm-intermission__scores">
        <li v-for="player in playerList" :key="player.id" class="wm-intermission__score-row">
          <span class="wm-intermission__score-dot" :style="{ background: player.color }" />
          <span class="wm-intermission__score-name">{{ player.name }}</span>
          <span class="wm-intermission__score-pts">{{ player.score }} pts</span>
        </li>
      </ul>

      <p v-if="roundNumber < totalRounds" class="wm-intermission__next">
        Next round in {{ intermissionLeft }}s…
      </p>
    </div>
  </section>
</template>

<style scoped>
.wm-intermission {
  grid-area: main;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
  padding: var(--spacing-3) 0;
}

.wm-intermission__card {
  background: #fff;
  color: #111;
  border: 3px solid #111;
  border-radius: 1.25rem;
  box-shadow: 5px 5px 0 #111;
  padding: var(--spacing-4);
  max-width: 28rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  text-align: center;
}

.wm-intermission__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 900;
  color: #111;
}

.wm-intermission__groups {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  text-align: left;
}

.wm-intermission__group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.wm-intermission__group-label {
  font-size: var(--font-size-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #555;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.wm-intermission__group-count {
  font-size: var(--font-size-xs);
  font-weight: 700;
  background: #f0f0f0;
  border-radius: 999px;
  padding: 0 var(--spacing-1);
  color: #777;
}

.wm-intermission__group-slots {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1);
}

.wm-intermission__slot {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid #ddd;
  border-radius: 999px;
  font-size: var(--font-size-sm);
  font-weight: 700;
  background: #fafafa;
}

.wm-intermission__slot--found {
  background: #f0fff4;
  border-color: var(--ws-green);
}

.wm-intermission__slot--missed {
  opacity: 0.45;
}

.wm-intermission__slot-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1.5px solid #111;
}

.wm-intermission__slot-word {
  color: #111;
}

.wm-intermission__scores {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  border-top: 2px solid #f0f0f0;
  padding-top: var(--spacing-3);
}

.wm-intermission__score-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid #f0f0f0;
  border-radius: 999px;
}

.wm-intermission__score-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 2px solid #111;
  flex-shrink: 0;
}

.wm-intermission__score-name {
  flex: 1;
  font-weight: 700;
  font-size: var(--font-size-sm);
  text-align: left;
}

.wm-intermission__score-pts {
  font-weight: 800;
  font-size: var(--font-size-sm);
  min-width: 3.5rem;
  text-align: right;
}

.wm-intermission__next {
  margin: 0;
  font-size: var(--font-size-sm);
  color: #888;
}
</style>
