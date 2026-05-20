<script setup lang="ts">
import { ref } from 'vue'
import { MAX_STROKES } from './config'

defineProps<{
  message: string
  waiting: boolean
  isAiming: boolean
  aimPower: number
  currentHole: number
  activeHolesLength: number
  par: number
  localStrokes: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
defineExpose({ canvas })
</script>

<template>
  <div class="mg-game">
    <div class="mg-game__bar">
      <div class="mg-game__center">
        <span v-if="message" class="mg-game__message">{{ message }}</span>
        <span v-else-if="waiting" class="mg-game__hint">Waiting for others…</span>
        <span v-else-if="!isAiming" class="mg-game__hint">Drag to aim &amp; shoot</span>
        <div v-else class="mg-game__power-bar">
          <div class="mg-game__power-fill" :style="{ width: `${aimPower}%` }" />
        </div>
      </div>
      <div class="mg-game__info">
        <span>Hole {{ currentHole + 1 }}/{{ activeHolesLength }}</span>
        <span>Par {{ par }}</span>
        <span>Stroke {{ localStrokes }}/{{ MAX_STROKES }}</span>
      </div>
    </div>
    <div class="mg-game__canvas">
      <canvas ref="canvas" />
    </div>
  </div>
</template>

<style scoped>
.mg-game {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 3px solid var(--game-border);
  box-shadow: 4px 4px 0 var(--game-border);
}

.mg-game__bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  border-bottom: 2px solid var(--game-border);
  background: var(--game-surface-subtle);
  flex-shrink: 0;
  min-height: 2.5rem;
}

.mg-game__center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
  gap: var(--spacing-2);
}

.mg-game__message {
  font-size: var(--font-size-sm);
  font-weight: 900;
  color: #fff;
  white-space: nowrap;
  animation: slide-up 0.15s ease both;
}

.mg-game__hint {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
}

.mg-game__power-bar {
  width: 160px;
  height: 14px;
  background: rgb(255, 255, 255, 0.25);
  border: 2px solid #fff;
  overflow: hidden;
}

.mg-game__power-fill {
  height: 100%;
  background: #fff;
  transition: width 0.05s ease-out;
}

.mg-game__info {
  display: flex;
  gap: var(--spacing-2);
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}

.mg-game__canvas {
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
