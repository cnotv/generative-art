<script setup lang="ts">
import type { PictionaryPlayer } from '@/stores/pictionary'

defineProps<{
  isDrawer: boolean
  drawerId: string
  choices: string[]
  timeLeft: number
  playerList: PictionaryPlayer[]
}>()

const emit = defineEmits<{
  pickWord: [word: string]
}>()

const drawerName = (playerList: PictionaryPlayer[], drawerId: string): string =>
  playerList.find((p) => p.id === drawerId)?.name ?? ''
</script>

<template>
  <section class="pictionary-choosing">
    <p class="pictionary-choosing__title">
      <span v-if="isDrawer">🎨 Pick a word to draw!</span>
      <span v-else>✨ {{ drawerName(playerList, drawerId) }} is picking a word…</span>
      <span class="pictionary-choosing__timer">⏱ {{ timeLeft }}s</span>
    </p>
    <div v-if="isDrawer" class="pictionary-choosing__choices">
      <button
        v-for="(choice, index) in choices"
        :key="choice"
        class="pictionary-choosing__choice-btn"
        :class="`pictionary-choosing__choice-btn--${index % 3}`"
        type="button"
        @click="emit('pickWord', choice)"
      >
        {{ choice }}
      </button>
    </div>
    <div v-else class="pictionary-choosing__choices pictionary-choosing__choices--placeholder">
      <div
        v-for="n in 3"
        :key="n"
        class="pictionary-choosing__choice-btn pictionary-choosing__choice-btn--ghost"
      >
        ?
      </div>
    </div>
  </section>
</template>

<style scoped>
.pictionary-choosing {
  grid-area: main;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4, 1.5rem);
  align-items: center;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.pictionary-choosing__title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #111;
  text-align: center;
  margin: 0;
}

.pictionary-choosing__choices {
  display: flex;
  gap: var(--spacing-3);
  flex-wrap: wrap;
  justify-content: center;
}

.pictionary-choosing__choice-btn {
  min-width: 180px;
  padding: var(--spacing-4, 1.5rem);
  border: 4px solid #111;
  border-radius: 1.25rem;
  font-size: 1.5rem;
  font-weight: 800;
  color: #111;
  cursor: pointer;
  box-shadow: 5px 5px 0 #111;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition:
    transform 0.1s ease,
    box-shadow 0.1s ease;
}

.pictionary-choosing__choice-btn--0 {
  background: var(--pic-pink);
  transform: rotate(-2deg);
}
.pictionary-choosing__choice-btn--1 {
  background: var(--pic-blue);
  transform: rotate(1.5deg);
}
.pictionary-choosing__choice-btn--2 {
  background: var(--pic-yellow);
  transform: rotate(-1deg);
}

.pictionary-choosing__choice-btn:hover {
  transform: translate(-2px, -2px) rotate(0deg);
  box-shadow: 7px 7px 0 #111;
}

.pictionary-choosing__choice-btn--ghost {
  background: #fff;
  color: #bbb;
  cursor: default;
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.15);
}
</style>
