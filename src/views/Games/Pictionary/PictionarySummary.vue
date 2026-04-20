<script setup lang="ts">
import { computed } from 'vue'
import { RotateCcw } from 'lucide-vue-next'
import type { PictionaryPlayer } from '@/stores/pictionary'

const props = defineProps<{
  playerList: PictionaryPlayer[]
  winnerId: string | null
  isHost: boolean
}>()

const emit = defineEmits<{
  restart: []
}>()

const topPlayers = computed(() => {
  const list = props.playerList
  if (list.length === 0) return []
  const top = list[0].score
  return list.filter((player) => player.score === top)
})

const winnerLabel = computed(() => {
  const top = topPlayers.value
  if (top.length === 0) return ''
  if (top.length === 1) return top[0].name
  if (top.length === 2) return `${top[0].name} and ${top[1].name}`
  return `${top
    .slice(0, -1)
    .map((player) => player.name)
    .join(', ')}, and ${top[top.length - 1].name}`
})
</script>

<template>
  <section class="pictionary-summary">
    <div class="pictionary-summary__fireworks" aria-hidden="true">
      <span
        v-for="i in 12"
        :key="i"
        :class="`pictionary-summary__firework pictionary-summary__firework--${i}`"
      />
    </div>
    <h2 class="pictionary-summary__title">Game over!</h2>
    <p v-if="topPlayers.length > 1" class="pictionary-summary__winner">
      It's a tie! <strong>{{ winnerLabel }}</strong> share {{ topPlayers[0].score }} points.
    </p>
    <p v-else-if="winnerId" class="pictionary-summary__winner">
      Winner: <strong>{{ winnerLabel }}</strong> with {{ topPlayers[0].score }} points.
    </p>
    <button
      v-if="isHost"
      class="pictionary-summary__restart-btn"
      type="button"
      :disabled="playerList.length < 2"
      @click="emit('restart')"
    >
      <RotateCcw class="pictionary-summary__btn-icon" />
      Restart game
    </button>
  </section>
</template>

<style scoped>
.pictionary-summary {
  grid-area: main;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  align-items: center;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.pictionary-summary > *:not(.pictionary-summary__fireworks) {
  position: relative;
  z-index: 1;
}

.pictionary-summary__title {
  margin: 0;
  font-size: 2.5rem;
  font-weight: 900;
  color: #111;
  text-align: center;
}

.pictionary-summary__winner {
  font-size: 1.25rem;
  color: #111;
  margin: 0;
  text-align: center;
}

.pictionary-summary__restart-btn {
  padding: var(--spacing-2) var(--spacing-5, 1.5rem);
  border: 3px solid #111;
  border-radius: 999px;
  background: var(--pic-pink);
  color: #fff;
  font-size: var(--font-size-md, 1rem);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
  transition: transform 0.1s ease;
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
}

.pictionary-summary__restart-btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 #111;
}

.pictionary-summary__restart-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: 2px 2px 0 #111;
}

.pictionary-summary__btn-icon {
  width: 1.1em;
  height: 1.1em;
}

.pictionary-summary__fireworks {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}

.pictionary-summary__firework {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  box-shadow:
    0 0 0 2px currentColor,
    0 0 12px 2px currentColor;
  opacity: 0;
  animation: pictionary-firework 2.4s infinite;
}

@keyframes pictionary-firework {
  0% {
    transform: scale(0) translate(0, 0);
    opacity: 1;
  }
  60% {
    opacity: 1;
  }
  100% {
    transform: scale(2.5) translate(var(--firework-dx, 0), var(--firework-dy, 0));
    opacity: 0;
  }
}

.pictionary-summary__firework--1 {
  color: var(--pic-pink);
  top: 20%;
  left: 15%;
  animation-delay: 0s;
  --firework-dx: -40px;
  --firework-dy: -30px;
}
.pictionary-summary__firework--2 {
  color: var(--pic-yellow);
  top: 25%;
  left: 80%;
  animation-delay: 0.3s;
  --firework-dx: 50px;
  --firework-dy: -20px;
}
.pictionary-summary__firework--3 {
  color: var(--pic-blue);
  top: 60%;
  left: 10%;
  animation-delay: 0.6s;
  --firework-dx: -30px;
  --firework-dy: 40px;
}
.pictionary-summary__firework--4 {
  color: var(--pic-orange);
  top: 15%;
  left: 50%;
  animation-delay: 0.9s;
  --firework-dx: 0;
  --firework-dy: -50px;
}
.pictionary-summary__firework--5 {
  color: var(--pic-purple);
  top: 70%;
  left: 75%;
  animation-delay: 1.2s;
  --firework-dx: 40px;
  --firework-dy: 30px;
}
.pictionary-summary__firework--6 {
  color: var(--pic-green);
  top: 40%;
  left: 20%;
  animation-delay: 0.15s;
  --firework-dx: -50px;
  --firework-dy: 0;
}
.pictionary-summary__firework--7 {
  color: var(--pic-pink);
  top: 50%;
  left: 90%;
  animation-delay: 0.45s;
  --firework-dx: 60px;
  --firework-dy: 0;
}
.pictionary-summary__firework--8 {
  color: var(--pic-yellow);
  top: 80%;
  left: 40%;
  animation-delay: 0.75s;
  --firework-dx: 0;
  --firework-dy: 50px;
}
.pictionary-summary__firework--9 {
  color: var(--pic-blue);
  top: 30%;
  left: 35%;
  animation-delay: 1.05s;
  --firework-dx: -20px;
  --firework-dy: -40px;
}
.pictionary-summary__firework--10 {
  color: var(--pic-orange);
  top: 65%;
  left: 55%;
  animation-delay: 1.35s;
  --firework-dx: 30px;
  --firework-dy: 30px;
}
.pictionary-summary__firework--11 {
  color: var(--pic-purple);
  top: 10%;
  left: 70%;
  animation-delay: 1.65s;
  --firework-dx: 40px;
  --firework-dy: -50px;
}
.pictionary-summary__firework--12 {
  color: var(--pic-green);
  top: 85%;
  left: 20%;
  animation-delay: 1.95s;
  --firework-dx: -40px;
  --firework-dy: 30px;
}
</style>
