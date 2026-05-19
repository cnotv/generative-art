<script setup lang="ts">
import { ref } from 'vue'
import type { BubbleColor } from './config'
import { COLOR_HEX } from './config'

defineProps<{
  score: number
  shotCount: number
  currentColor: BubbleColor
  nextColor: BubbleColor
  opponentScore?: number
  opponentName?: string
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
defineExpose({ canvas })
</script>

<template>
  <div class="bs-game">
    <div class="bs-game__hud">
      <div class="bs-game__hud-left">
        <span class="bs-game__label">Score</span>
        <span class="bs-game__value">{{ score }}</span>
      </div>
      <div class="bs-game__next">
        <span
          class="bs-game__next-bubble"
          :style="{ background: `#${COLOR_HEX[currentColor].toString(16).padStart(6, '0')}` }"
        />
        <span class="bs-game__label">Next</span>
        <span
          class="bs-game__next-bubble bs-game__next-bubble--small"
          :style="{ background: `#${COLOR_HEX[nextColor].toString(16).padStart(6, '0')}` }"
        />
      </div>
      <div v-if="opponentName !== undefined" class="bs-game__hud-right">
        <span class="bs-game__label">{{ opponentName }}</span>
        <span class="bs-game__value">{{ opponentScore ?? 0 }}</span>
      </div>
    </div>
    <div class="bs-game__canvas-wrap">
      <canvas ref="canvas" />
    </div>
  </div>
</template>

<style scoped>
.bs-game {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: var(--radius-lg, 1.25rem);
  border: 3px solid var(--game-border);
  box-shadow: 4px 4px 0 var(--game-border);
}

.bs-game__hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--game-surface-subtle);
  border-bottom: 2px solid var(--game-border);
  flex-shrink: 0;
  gap: var(--spacing-3);
}

.bs-game__hud-left,
.bs-game__hud-right,
.bs-game__next {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.bs-game__label {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--game-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.bs-game__value {
  font-size: var(--font-size-md, 1rem);
  font-weight: 900;
  color: var(--game-ink);
  min-width: 3ch;
  text-align: right;
}

.bs-game__next-bubble {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  border: 2px solid var(--game-border);
  display: inline-block;
  flex-shrink: 0;
}

.bs-game__next-bubble--small {
  width: 0.875rem;
  height: 0.875rem;
  opacity: 0.75;
}

.bs-game__canvas-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
