<script setup lang="ts">
import '@/assets/styles/lobby-ui.scss'

withDefaults(
  defineProps<{
    title: string
    variant?: 'overlay' | 'transparent'
  }>(),
  { variant: 'overlay' }
)
</script>

<template>
  <div class="game-scores" :class="{ 'game-scores--transparent': variant === 'transparent' }">
    <div class="game-scores__card">
      <h2 class="game-scores__title">{{ title }}</h2>
      <slot />
      <div v-if="$slots.actions" class="game-scores__actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-scores {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 0.55);
  padding: var(--spacing-4);
}

.game-scores--transparent {
  background: none;
}

.game-scores__card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-5) var(--spacing-6);
  align-items: center;
  width: min(560px, 100%);
  text-align: center;
}

.game-scores__title {
  font-family: var(--lui-font);
  font-size: var(--lui-text-important);
  font-weight: 900;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.game-scores__actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: center;
}
</style>
