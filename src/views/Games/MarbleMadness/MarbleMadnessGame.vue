<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  elapsed: number
  finished: boolean
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
defineExpose({ canvas })

const elapsedDisplay = computed((): string => {
  const total = Math.floor(props.elapsed)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
})
</script>

<template>
  <div class="mm-game">
    <div class="mm-game__hud">
      <span class="mm-game__time">{{ elapsedDisplay }}</span>
      <span v-if="finished" class="mm-game__done">Finished!</span>
      <span v-else class="mm-game__hint">WASD / Arrow keys to roll</span>
    </div>
    <canvas ref="canvas" class="mm-game__canvas" />
  </div>
</template>

<style scoped>
.mm-game {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-lg, 1.25rem);
  border: 3px solid var(--game-border);
  box-shadow: 4px 4px 0 var(--game-border);
}

.mm-game__canvas {
  flex: 1;
  width: 100%;
  display: block;
}

.mm-game__hud {
  position: absolute;
  top: var(--spacing-3);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  background: color-mix(in srgb, var(--game-surface-subtle) 85%, transparent);
  border: 2px solid var(--game-border);
  border-radius: 999px;
  padding: var(--spacing-1) var(--spacing-4);
  backdrop-filter: blur(4px);
  z-index: 10;
}

.mm-game__time {
  font-size: var(--font-size-lg, 1.25rem);
  font-weight: 800;
  color: var(--game-ink);
  font-variant-numeric: tabular-nums;
}

.mm-game__hint {
  font-size: var(--font-size-sm);
  color: var(--game-ink-muted);
}

.mm-game__done {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--mm-accent);
}
</style>
