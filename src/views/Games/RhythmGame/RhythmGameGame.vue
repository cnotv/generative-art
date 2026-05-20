<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import TouchControl from '@/components/TouchControl.vue'
import { useRhythmGame } from './useRhythmGame'
import { LANE_DIRECTIONS, type RgSong, type RgDifficulty } from './config'
import type { RgScore } from '@/stores/rhythmGame'

const props = defineProps<{
  song: RgSong
  difficulty: RgDifficulty
  startAt: number
  opponentName?: string
  opponentScore?: number
}>()

const emit = defineEmits<{
  scoreUpdate: [data: RgScore]
  songEnd: []
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let controls: { destroyControls: () => void } | null = null

const game = useRhythmGame({
  canvas,
  song: props.song,
  difficulty: props.difficulty,
  startAt: props.startAt,
  onScoreUpdate: (data) => emit('scoreUpdate', data),
  onSongEnd: () => emit('songEnd')
})

const resizeCanvas = (): void => {
  const element = canvas.value
  if (!element) return
  element.width = element.offsetWidth
  element.height = element.offsetHeight
}

const fauxPadMapping: Record<string, string> = Object.fromEntries(
  LANE_DIRECTIONS.map((dir, i) => [dir, `lane-${i}`])
)

const handleFauxAction = (action: string): void => {
  if (!action.startsWith('lane-')) return
  const lane = parseInt(action.split('-')[1]) as import('./config').RgLane
  game.laneActive.value = game.laneActive.value.map((_, i) => i === lane) as boolean[]
  game.pressLane(lane)
  setTimeout(() => {
    game.laneActive.value = game.laneActive.value.map((_, i) =>
      i === lane ? false : game.laneActive.value[i]
    ) as boolean[]
  }, 120)
}

onMounted(async () => {
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  controls = game.mountControls(canvas.value)

  // Wait until startAt
  const delay = props.startAt - Date.now()
  if (delay > 0) await new Promise((r) => setTimeout(r, delay))
  game.init()
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  controls?.destroyControls()
  game.destroy()
})
</script>

<template>
  <div class="rg-game">
    <div class="rg-game__hud">
      <div class="rg-game__hud-left">
        <span class="rg-game__label">Score</span>
        <span class="rg-game__value">{{ game.score.value.toLocaleString() }}</span>
      </div>
      <div class="rg-game__hud-center">
        <span class="rg-game__song-label">{{ song.replace(/-/g, ' ').toUpperCase() }}</span>
        <span class="rg-game__difficulty">{{ difficulty }}</span>
      </div>
      <div v-if="opponentName" class="rg-game__hud-right">
        <span class="rg-game__label">{{ opponentName }}</span>
        <span class="rg-game__value">{{ (opponentScore ?? 0).toLocaleString() }}</span>
      </div>
    </div>

    <div class="rg-game__canvas-wrap">
      <canvas ref="canvas" class="rg-game__canvas" />
    </div>

    <div class="rg-game__faux-pad">
      <TouchControl :mapping="fauxPadMapping" mode="faux-pad" :on-action="handleFauxAction" />
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
}

.rg-game__hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-2) var(--spacing-3);
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
  color: rgba(255, 255, 255, 0.4);
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
  color: rgba(255, 255, 255, 0.4);
  text-transform: capitalize;
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

.rg-game__faux-pad {
  display: none;
}

@media (max-width: 720px) {
  .rg-game__faux-pad {
    display: flex;
    justify-content: center;
    padding: var(--spacing-2);
    flex-shrink: 0;
  }
}
</style>
