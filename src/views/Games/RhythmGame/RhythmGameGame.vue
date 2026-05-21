<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRhythmGame } from './useRhythmGame'
import {
  LANES,
  type RgLane,
  type RgSong,
  type RgDifficulty,
  type RgInstrument,
  type RhythmNote
} from './config'
import type { RgScore } from '@/stores/rhythmGame'
import type { ScheduledNote } from '@webgamekit/audio'

const props = defineProps<{
  song: RgSong
  difficulty: RgDifficulty
  instrument: RgInstrument
  startAt: number
  customNotes?: RhythmNote[] | null
  backgroundNotes?: ScheduledNote[] | null
  songName?: string
  opponentName?: string
  opponentScore?: number
}>()

const emit = defineEmits<{
  scoreUpdate: [data: RgScore]
  songEnd: []
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const gameContainer = ref<HTMLDivElement | null>(null)
const countdownValue = ref<number | null>(null)
let controls: { destroyControls: () => void } | null = null

const game = useRhythmGame({
  canvas,
  song: props.song,
  difficulty: props.difficulty,
  instrument: props.instrument,
  startAt: props.startAt,
  customNotes: props.customNotes,
  backgroundNotes: props.backgroundNotes,
  onScoreUpdate: (data) => emit('scoreUpdate', data),
  onSongEnd: () => emit('songEnd')
})

const resizeCanvas = (): void => {
  const element = canvas.value
  if (!element) return
  element.width = element.offsetWidth
  element.height = element.offsetHeight
}

const pressLaneAt = (clientX: number): void => {
  const element = canvas.value
  if (!element) return
  const { left, width } = element.getBoundingClientRect()
  const lane = Math.min(
    LANES - 1,
    Math.max(0, Math.floor(((clientX - left) / width) * LANES))
  ) as RgLane
  game.laneActive.value = game.laneActive.value.map((_, i) => i === lane) as boolean[]
  game.pressLane(lane)
  setTimeout(() => {
    game.laneActive.value = game.laneActive.value.map((_, i) =>
      i === lane ? false : game.laneActive.value[i]
    ) as boolean[]
  }, 120)
}

const handleCanvasClick = (event: MouseEvent): void => pressLaneAt(event.clientX)

const handleCanvasTouch = (event: TouchEvent): void => {
  event.preventDefault()
  ;[...event.changedTouches].forEach((t) => pressLaneAt(t.clientX))
}

onMounted(async () => {
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  controls = game.mountControls(gameContainer.value)

  const delay = Math.max(0, props.startAt - Date.now())
  if (delay >= 3000) countdownValue.value = 3
  if (delay >= 2000)
    setTimeout(() => {
      countdownValue.value = 2
    }, delay - 2000)
  if (delay >= 1000)
    setTimeout(() => {
      countdownValue.value = 1
    }, delay - 1000)

  await new Promise<void>((r) => setTimeout(r, delay))
  countdownValue.value = 0
  await new Promise<void>((r) => setTimeout(r, 400))
  countdownValue.value = null
  game.init()
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  controls?.destroyControls()
  game.destroy()
})
</script>

<template>
  <div ref="gameContainer" class="rg-game" tabindex="0">
    <div class="rg-game__hud">
      <div class="rg-game__hud-left">
        <span class="rg-game__label">Score</span>
        <span class="rg-game__value">{{ game.score.value.toLocaleString() }}</span>
      </div>
      <div class="rg-game__hud-center">
        <span class="rg-game__song-label">{{ (songName || song).toUpperCase() }}</span>
      </div>
      <div v-if="opponentName" class="rg-game__hud-right">
        <span class="rg-game__label">{{ opponentName }}</span>
        <span class="rg-game__value">{{ (opponentScore ?? 0).toLocaleString() }}</span>
      </div>
    </div>

    <div v-if="game.songDurationMs.value > 0" class="rg-game__progress">
      <div class="rg-game__progress-fill" :style="{ width: `${game.progressPct.value * 100}%` }" />
    </div>

    <div class="rg-game__canvas-wrap">
      <canvas
        ref="canvas"
        class="rg-game__canvas"
        @click="handleCanvasClick"
        @touchstart="handleCanvasTouch"
      />
      <Transition name="rg-countdown">
        <div v-if="countdownValue !== null" class="rg-game__countdown">
          {{ countdownValue === 0 ? 'GO!' : countdownValue }}
        </div>
      </Transition>
      <div
        v-if="game.lastHit.value"
        :key="game.hitKey.value"
        class="rg-game__hit-text"
        :class="`rg-game__hit-text--${game.lastHit.value}`"
      >
        {{
          game.lastHit.value === 'perfect'
            ? 'PERFECT!'
            : game.lastHit.value === 'good'
              ? 'GOOD!'
              : 'MISS'
        }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.rg-game {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: var(--radius-lg, 1.25rem);
  border: 2px solid var(--game-border);
  box-shadow: 4px 4px 0 var(--game-border);
  background: #07070f;
  outline: none;
}

.rg-game__hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-2) var(--spacing-3);
  background: rgb(255, 255, 255, 0.04);
  border-bottom: 1px solid rgb(255, 255, 255, 0.08);
  flex-shrink: 0;
  gap: var(--spacing-2);
}

.rg-game__hud-left,
.rg-game__hud-right,
.rg-game__hud-center {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.rg-game__hud-center {
  flex-direction: column;
  gap: 2px;
  text-align: center;
}

.rg-game__label {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: rgb(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.rg-game__value {
  font-size: var(--font-size-md, 1rem);
  font-weight: 900;
  color: #fff;
  min-width: 5ch;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.rg-game__song-label {
  font-size: var(--font-size-xs);
  font-weight: 900;
  color: #fff;
  letter-spacing: 0.08em;
}

.rg-game__difficulty {
  font-size: 10px;
  color: rgb(255, 255, 255, 0.4);
  text-transform: capitalize;
}

.rg-game__progress {
  height: 3px;
  background: rgb(255 255 255 / 8%);
  flex-shrink: 0;
}

.rg-game__progress-fill {
  height: 100%;
  background: var(--game-accent, #00e5ff);
  transition: width 0.1s linear;
}

.rg-game__canvas-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
}

.rg-game__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.rg-game__countdown {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 6rem;
  font-weight: 900;
  font-family: monospace;
  color: #fff;
  text-shadow: 0 0 40px var(--game-accent, #00e5ff);
  pointer-events: none;
  z-index: 10;
}

.rg-countdown-enter-active,
.rg-countdown-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.rg-countdown-enter-from {
  opacity: 0;
  transform: scale(1.5);
}

.rg-countdown-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.rg-game__hit-text {
  position: absolute;
  left: 50%;
  top: 78%;
  font-size: 1.4rem;
  font-weight: 900;
  font-family: monospace;
  letter-spacing: 0.08em;
  pointer-events: none;
  z-index: 5;
  text-shadow: 0 0 16px currentcolor;
  animation: rg-hit-fade 0.5s ease forwards;
}

.rg-game__hit-text--perfect {
  color: #ffd740;
}

.rg-game__hit-text--good {
  color: #69ff47;
}

.rg-game__hit-text--miss {
  color: #ff4040;
}

@keyframes rg-hit-fade {
  0% {
    opacity: 1;
    transform: translateX(-50%) translateY(-80%) scale(0.8);
  }

  25% {
    opacity: 1;
    transform: translateX(-50%) translateY(-100%) scale(1.05);
  }

  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-140%);
  }
}
</style>
