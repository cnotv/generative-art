<script setup lang="ts">
import { ref } from 'vue'
import { MAX_STROKES } from './config'
import type { ScoreType } from './helpers/score'
import '@/assets/styles/lobby-ui.scss'

defineProps<{
  message: string
  scoreLabel: string | null
  scoreType: ScoreType | null
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
    <div class="mg-game__canvas">
      <div class="mg-game__bar">
        <div class="mg-game__center">
          <template v-if="message">
            <Transition name="mg-score" mode="out-in">
              <span :key="message" class="mg-game__message">
                <span
                  v-if="scoreLabel"
                  class="mg-game__score-label"
                  :class="scoreType ? `mg-game__score-label--${scoreType}` : ''"
                  >{{ scoreLabel }}</span
                >
                {{ message }}
              </span>
            </Transition>
          </template>
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
  width: 100%;
  flex: 1;
  min-height: 0;
}

.mg-game__bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-overlay);
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  pointer-events: none;
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
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 900;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  white-space: nowrap;
}

.mg-game__score-label {
  display: inline-block;
  font-size: var(--lui-text-medium);
  font-weight: 900;
  margin-right: var(--spacing-1);
  text-shadow: var(--lui-text-shadow);
}

.mg-game__score-label--hole-in-one {
  color: var(--score-hole-in-one);
}

.mg-game__score-label--eagle {
  color: var(--score-eagle);
}

.mg-game__score-label--birdie {
  color: var(--score-birdie);
}

.mg-game__score-label--par {
  color: var(--score-par);
}

.mg-game__score-label--bogey {
  color: var(--score-bogey);
}

.mg-game__score-label--double-bogey-plus {
  color: var(--score-double-bogey-plus);
}

.mg-score-enter-active {
  animation: mg-score-pop 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

.mg-score-leave-active {
  display: none;
}

@keyframes mg-score-pop {
  0% {
    opacity: 0;
    transform: scale(0.6) translateY(6px);
  }

  60% {
    opacity: 1;
    transform: scale(1.1) translateY(-2px);
  }

  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.mg-game__hint {
  font-family: var(--lui-font);
  font-size: var(--lui-text-tiny);
  font-weight: 600;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  white-space: nowrap;
}

.mg-game__power-bar {
  width: 160px;
  height: 14px;
  background: rgb(255 255 255 / 0.25);
  border: 2px solid var(--lui-stroke);
  overflow: hidden;
}

.mg-game__power-fill {
  height: 100%;
  background: var(--lui-stroke);
  transition: width 0.05s ease-out;
}

.mg-game__info {
  display: flex;
  gap: var(--spacing-2);
  font-family: var(--lui-font);
  font-size: var(--lui-text-tiny);
  font-weight: 700;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
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
