<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { MePlayer } from './types'

const props = defineProps<{
  playerList: MePlayer[]
  localPeerId: string
  canRestart: boolean
}>()

const emit = defineEmits<{
  restart: []
  back: []
}>()

const playAgainReference = ref<HTMLButtonElement | null>(null)

const formatTime = (seconds: number | null): string => {
  if (seconds === null) return '--:--'
  const minutes = Math.floor(seconds / 60)
  const rest = (seconds % 60).toFixed(1).padStart(4, '0')
  return `${minutes}:${rest}`
}

onMounted(() => {
  if (props.canRestart) playAgainReference.value?.focus()
})
</script>

<template>
  <div class="me-summary">
    <h2 class="me-summary__title">Race results</h2>
    <ol class="me-summary__list">
      <li
        v-for="(player, index) in playerList"
        :key="player.id"
        class="me-summary__row"
        :class="{ 'me-summary__row--local': player.id === localPeerId }"
      >
        <span class="me-summary__rank">{{ index + 1 }}</span>
        <span class="me-summary__name" :style="{ color: player.color }">{{ player.name }}</span>
        <span class="me-summary__time">{{ formatTime(player.finishTime) }}</span>
      </li>
    </ol>
    <div class="me-summary__actions">
      <button
        v-if="canRestart"
        ref="playAgainReference"
        class="me-summary__button me-summary__button--cta"
        title="Race the track again"
        @click="emit('restart')"
      >
        Play again
      </button>
      <button class="me-summary__button" title="Return to the track editor" @click="emit('back')">
        Back to editor
      </button>
    </div>
  </div>
</template>

<style scoped>
.me-summary {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  align-items: stretch;
  min-width: 20rem;
  padding: var(--spacing-6);
  color: var(--color-foreground);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  transform: translate(-50%, -50%);
}

.me-summary__title {
  margin: 0;
  font-size: var(--font-size-xl);
  text-align: center;
}

.me-summary__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  padding: 0;
  margin: 0;
  list-style: none;
}

.me-summary__row {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-md);
}

.me-summary__row--local {
  background: var(--color-secondary);
}

.me-summary__rank {
  min-width: 1.5rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.me-summary__name {
  flex: 1;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.me-summary__time {
  font-variant-numeric: tabular-nums;
}

.me-summary__actions {
  display: flex;
  gap: var(--spacing-2);
  justify-content: center;
}

.me-summary__button {
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  cursor: pointer;
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.me-summary__button--cta {
  color: var(--color-primary-foreground);
  background: var(--color-primary);
}

.me-summary__button:focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}
</style>
