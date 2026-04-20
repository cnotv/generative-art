<script setup lang="ts">
defineProps<{
  roundNumber: number
  totalRounds: number
  intermissionLeft: number
  word: string | null
}>()
</script>

<template>
  <section class="pictionary-intermission">
    <p class="pictionary-intermission__title">
      ⏭ Round {{ Math.min(roundNumber + 1, totalRounds) }} of {{ totalRounds }} starting…
    </p>
    <div class="pictionary-intermission__timer">{{ intermissionLeft }}</div>
    <p v-if="word" class="pictionary-intermission__word">
      The word was <strong>{{ word }}</strong>
    </p>
  </section>
</template>

<style scoped>
.pictionary-intermission {
  grid-area: main;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  align-items: center;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.pictionary-intermission__title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #111;
  margin: 0;
}

.pictionary-intermission__timer {
  font-size: 5rem;
  font-weight: 900;
  color: #111;
  background: var(--pic-yellow);
  border: 4px solid #111;
  border-radius: 50%;
  width: 8rem;
  height: 8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 5px 5px 0 #111;
}

.pictionary-intermission__word {
  font-size: 1.25rem;
  color: #111;
  margin: 0;
}
</style>
