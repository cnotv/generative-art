<script setup lang="ts">
import { ref } from 'vue'
import { isMobile } from '@webgamekit/controls'
import TouchControl from '@/components/TouchControl.vue'
import { KEYBOARD_MAPPING, SCORE_POPUP_DURATION_MS } from './config'
import type { BbScorePopup } from './types'

defineProps<{
  score: number
  highScore: number
  lives: number
  countdownSeconds: number
  remainingSeconds: number | null
  scorePopups: BbScorePopup[]
  currentActions: Record<string, unknown>
}>()

const isMobileDevice = isMobile()
const canvas = ref<HTMLCanvasElement | null>(null)
defineExpose({ canvas })

const formatClock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
</script>

<template>
  <div class="bb-game">
    <canvas ref="canvas" class="bb-game__canvas" />
    <div class="bb-game__hud">
      <div class="bb-game__stat">
        <span class="bb-game__label">Score</span>
        <span class="bb-game__value">{{ score }}</span>
        <span v-if="highScore > 0" class="bb-game__label">Best {{ highScore }}</span>
      </div>
      <span v-if="remainingSeconds !== null" class="bb-game__value">
        {{ formatClock(remainingSeconds) }}
      </span>
      <div class="bb-game__stat">
        <span class="bb-game__label">Balls</span>
        <span class="bb-game__value">{{ lives }}</span>
      </div>
    </div>
    <span v-if="countdownSeconds > 0" class="bb-game__countdown">{{ countdownSeconds }}</span>
    <span
      v-for="popup in scorePopups"
      :key="popup.id"
      class="bb-game__popup"
      :style="{
        left: `${popup.xPercent}%`,
        top: `${popup.yPercent}%`,
        animationDuration: `${SCORE_POPUP_DURATION_MS}ms`
      }"
    >
      +{{ popup.points }}
    </span>
    <TouchControl
      v-if="isMobileDevice"
      class="bb-game__fauxpad"
      :mapping="KEYBOARD_MAPPING['faux-pad']"
      :options="{ deadzone: 0.15 }"
      :current-actions="currentActions"
      :on-action="() => {}"
    />
  </div>
</template>

<style scoped>
.bb-game {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.bb-game__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.bb-game__hud {
  position: absolute;
  inset: 0 0 auto;
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  pointer-events: none;
}

.bb-game__stat {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-2);
}

.bb-game__label {
  font-family: var(--lui-font);
  font-size: var(--lui-text-tiny);
  font-weight: 700;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
}

.bb-game__value {
  font-family: var(--lui-font);
  font-size: var(--lui-text-medium);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.bb-game__countdown {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--lui-font);
  font-size: var(--lui-text-important);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  pointer-events: none;
}

.bb-game__popup {
  position: absolute;
  z-index: var(--z-sticky);
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 900;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  pointer-events: none;
  transform: translate(-50%, -50%);
  animation: bb-popup-rise ease-out forwards;
}

.bb-game__fauxpad {
  position: absolute;
  bottom: var(--spacing-6);
  left: var(--spacing-6);
}

@keyframes bb-popup-rise {
  from {
    opacity: 1;
    transform: translate(-50%, -50%);
  }

  to {
    opacity: 0;
    transform: translate(-50%, -150%);
  }
}
</style>
