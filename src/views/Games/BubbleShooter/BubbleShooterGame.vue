<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { WATER_RISE_DURATION_MS, SCORE_POPUP_DURATION_MS } from './config'
import type { ScorePopupItem } from './types'

defineProps<{
  score: number
  shotCount: number
  highScore: number
  isGameOver: boolean
  opponentScore?: number
  opponentName?: string
  scorePopups: ScorePopupItem[]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const showEntranceOverlay = ref(true)
defineExpose({ canvas })

onMounted(() => {
  setTimeout(() => {
    showEntranceOverlay.value = false
  }, WATER_RISE_DURATION_MS)
})
</script>

<template>
  <div class="bs-game">
    <div class="bs-game__canvas-wrap">
      <canvas ref="canvas" />
      <div class="bs-game__hud">
        <div class="bs-game__hud-left">
          <span class="bs-game__label">Score</span>
          <span class="bs-game__value">{{ score }}</span>
          <span v-if="highScore > 0" class="bs-game__best">Best: {{ highScore }}</span>
        </div>
        <div v-if="opponentName !== undefined" class="bs-game__hud-right">
          <span class="bs-game__label">{{ opponentName }}</span>
          <span class="bs-game__value">{{ opponentScore ?? 0 }}</span>
        </div>
      </div>
      <div
        v-if="showEntranceOverlay"
        class="bs-game__gameover"
        :style="{ '--bs-gameover-duration': `${WATER_RISE_DURATION_MS}ms` }"
      >
        <div class="bs-game__water bs-game__water--drain">
          <div class="bs-game__water-wave" />
        </div>
      </div>
      <div
        v-if="isGameOver"
        class="bs-game__gameover"
        :style="{ '--bs-gameover-duration': `${WATER_RISE_DURATION_MS}ms` }"
      >
        <div class="bs-game__water">
          <div class="bs-game__water-wave" />
        </div>
      </div>
      <div class="bs-game__popups">
        <div
          v-for="popup in scorePopups"
          :key="popup.id"
          class="bs-game__score-popup"
          :class="{ 'bs-game__score-popup--combo': popup.comboPoints > 0 }"
          :style="{
            left: `${popup.xPercent}%`,
            top: `${popup.yPercent}%`,
            '--bs-score-popup-duration': `${SCORE_POPUP_DURATION_MS}ms`
          }"
        >
          <span class="bs-game__score-popup-value">+{{ popup.points }}</span>
          <span v-if="popup.comboPoints > 0" class="bs-game__score-popup-combo">
            Combo +{{ popup.comboPoints }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bs-game {
  height: 100%;
  min-height: 0;
}

.bs-game__hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-2) var(--spacing-3);
  gap: var(--spacing-3);
}

.bs-game__hud-left,
.bs-game__hud-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.bs-game__label {
  font-family: var(--lui-font);
  font-size: var(--lui-text-tiny);
  font-weight: 700;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.75;
}

.bs-game__value {
  font-family: var(--lui-font);
  font-size: var(--lui-text-medium);
  font-weight: 900;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  min-width: 3ch;
  text-align: right;
}

.bs-game__best {
  font-family: var(--lui-font);
  font-size: var(--lui-text-tiny);
  font-weight: 600;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  opacity: 0.6;
}

.bs-game__canvas-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.bs-game__gameover {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
}

.bs-game__water {
  position: absolute;
  left: -10%;
  right: -10%;
  bottom: 0;
  height: 0%;
  background: linear-gradient(180deg, var(--color-water-surface) 0%, var(--color-water-deep) 100%);
  opacity: 0.8;
  animation: bs-water-rise var(--bs-gameover-duration) linear forwards;
}

.bs-game__water--drain {
  height: 100%;
  animation-name: bs-water-drain;
}

.bs-game__water-wave {
  position: absolute;
  top: -1.5rem;
  left: -4rem;
  right: -4rem;
  height: 3rem;
  background-image: radial-gradient(
    ellipse at center,
    var(--color-water-surface) 60%,
    transparent 65%
  );
  background-size: 4rem 3rem;
  background-repeat: repeat-x;
  animation:
    bs-water-wave 0.7s linear infinite,
    bs-water-sway 0.9s ease-in-out infinite alternate;
}

@keyframes bs-water-rise {
  from {
    height: 0%;
  }

  to {
    height: 100%;
  }
}

@keyframes bs-water-drain {
  from {
    height: 100%;
  }

  to {
    height: 0%;
  }
}

@keyframes bs-water-wave {
  from {
    background-position-x: 0;
  }

  to {
    background-position-x: -4rem;
  }
}

@keyframes bs-water-sway {
  from {
    transform: translateX(-5rem);
  }

  to {
    transform: translateX(5rem);
  }
}

.bs-game__popups {
  position: absolute;
  inset: 0;
  z-index: var(--z-sticky);
  overflow: hidden;
  pointer-events: none;
}

.bs-game__score-popup {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  font-family: var(--lui-font);
  white-space: nowrap;
  animation: bs-score-popup-float var(--bs-score-popup-duration) ease-out forwards;
}

.bs-game__score-popup-value {
  font-size: var(--lui-text-medium);
  font-weight: 900;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.bs-game__score-popup-combo {
  font-size: var(--lui-text-tiny);
  font-weight: 700;
  color: var(--lui-focus-color);
  text-shadow: var(--lui-text-shadow);
}

@keyframes bs-score-popup-float {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  to {
    opacity: 0;
    transform: translate(-50%, calc(-50% - 4rem)) scale(1.2);
  }
}
</style>
