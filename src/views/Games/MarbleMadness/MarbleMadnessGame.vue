<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { isMobile } from '@webgamekit/controls'
import TouchControl from '@/components/TouchControl.vue'
import { TIME_PENALTY_FALL } from './config'
import type { GameMode } from './types'

const isMobileDevice = isMobile()

const props = defineProps<{
  mode: GameMode
  elapsed: number
  countdown: number
  distance: number
  finished: boolean
  penaltyCount: number
  trackName: string
  currentActions?: Record<string, unknown>
}>()

const emit = defineEmits<{ escape: [] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
defineExpose({ canvas })

const elapsedDisplay = computed((): string => {
  const total = Math.floor(props.elapsed)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
})

const countdownDisplay = computed((): string => String(Math.ceil(props.countdown)).padStart(2, '0'))
const distanceDisplay = computed((): string => `${Math.floor(props.distance)}m`)
const countdownLow = computed((): boolean => props.countdown <= 10)

const PENALTY_DISPLAY_MS = 1500
const showPenalty = ref(false)
let penaltyTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.penaltyCount,
  (count) => {
    if (count === 0) return
    if (penaltyTimer) clearTimeout(penaltyTimer)
    showPenalty.value = true
    penaltyTimer = setTimeout(() => {
      showPenalty.value = false
      penaltyTimer = null
    }, PENALTY_DISPLAY_MS)
  }
)

const showInstructions = ref(true)

const hideInstructions = (): void => {
  showInstructions.value = false
}

const handleEscKey = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') emit('escape')
}

const TRACK_NAME_DISPLAY_MS = 2200
const showTrackName = ref(false)
let trackNameTimer: ReturnType<typeof setTimeout> | null = null

const flashTrackName = (): void => {
  if (trackNameTimer) clearTimeout(trackNameTimer)
  showTrackName.value = true
  trackNameTimer = setTimeout(() => {
    showTrackName.value = false
    trackNameTimer = null
  }, TRACK_NAME_DISPLAY_MS)
}

watch(() => props.trackName, flashTrackName)

onMounted(() => {
  window.addEventListener('keydown', hideInstructions, { once: true })
  window.addEventListener('touchstart', hideInstructions, { once: true })
  window.addEventListener('keydown', handleEscKey)
  flashTrackName()
})

onUnmounted(() => {
  window.removeEventListener('keydown', hideInstructions)
  window.removeEventListener('touchstart', hideInstructions)
  window.removeEventListener('keydown', handleEscKey)
  if (penaltyTimer) clearTimeout(penaltyTimer)
  if (trackNameTimer) clearTimeout(trackNameTimer)
})
</script>

<template>
  <div class="mm-game">
    <template v-if="mode === 'rush'">
      <span class="mm-game__time" :class="{ 'mm-game__time--low': countdownLow }">
        {{ countdownDisplay }}
      </span>
      <span class="mm-game__distance">{{ distanceDisplay }}</span>
    </template>
    <span v-else class="mm-game__time">{{ elapsedDisplay }}</span>

    <Transition name="mm-penalty">
      <span v-if="showPenalty" :key="penaltyCount" class="mm-game__penalty">
        {{ mode === 'rush' ? `-${TIME_PENALTY_FALL}s` : `+${TIME_PENALTY_FALL}s` }}
      </span>
    </Transition>

    <Transition name="mm-track-name">
      <div v-if="showTrackName && mode === 'race'" class="mm-game__track-name">
        {{ trackName }}
      </div>
    </Transition>

    <Transition name="mm-instructions">
      <div v-if="showInstructions && !finished" class="mm-game__instructions">
        <span class="mm-game__instructions-move">WASD / Arrow keys to roll</span>
        <span class="mm-game__instructions-esc">Esc — Settings</span>
      </div>
    </Transition>

    <canvas ref="canvas" class="mm-game__canvas" />

    <TouchControl
      v-if="isMobileDevice && currentActions"
      class="mm-game__fauxpad"
      :mapping="{ up: 'forward', down: 'backward', left: 'left', right: 'right' }"
      :options="{ deadzone: 0.15 }"
      :current-actions="currentActions"
      :on-action="() => {}"
    />
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
}

.mm-game__canvas {
  flex: 1;
  width: 100%;
  display: block;
}

.mm-game__fauxpad {
  position: absolute;
  left: var(--spacing-6);
  bottom: var(--spacing-6);
}

.mm-game__time {
  position: absolute;
  top: var(--spacing-3);
  left: 50%;
  transform: translateX(-50%);
  font-size: clamp(2rem, 6vw, 4rem);
  font-weight: 900;
  font-family: var(--font-playful);
  color: #333;
  font-variant-numeric: tabular-nums;
  text-shadow: var(--shadow-text-game-large);
  z-index: 10;
  white-space: nowrap;
  pointer-events: none;
  line-height: 1;
}

.mm-game__time--low {
  color: #f44;
}

.mm-game__distance {
  position: absolute;
  top: var(--spacing-3);
  right: var(--spacing-4);
  font-size: clamp(1.25rem, 3vw, 2rem);
  font-weight: 900;
  font-family: var(--font-playful);
  color: #fff;
  font-variant-numeric: tabular-nums;
  text-shadow: var(--shadow-text-game);
  z-index: 10;
  white-space: nowrap;
  pointer-events: none;
  line-height: 1;
}

.mm-game__penalty {
  position: absolute;
  top: 5rem;
  left: 50%;
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 900;
  font-family: var(--font-playful);
  color: #f44;
  pointer-events: none;
  z-index: 20;
  white-space: nowrap;
  text-shadow: var(--shadow-text-game);
  line-height: 1;
}

.mm-game__track-name {
  position: absolute;
  top: 4.5rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: clamp(1.25rem, 3vw, 2rem);
  font-weight: 900;
  font-family: var(--font-playful);
  color: #fff;
  text-shadow: var(--shadow-text-game);
  text-transform: uppercase;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
  line-height: 1;
}

.mm-track-name-enter-active {
  animation: mm-track-name-in 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

.mm-track-name-leave-active {
  animation: mm-track-name-in 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) reverse both;
}

@keyframes mm-track-name-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.mm-game__instructions {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  pointer-events: none;
  z-index: 15;
  text-transform: uppercase;
}

.mm-game__instructions-move {
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  font-weight: 900;
  font-family: var(--font-playful);
  color: #fff;
  text-shadow: var(--shadow-text-game);
  line-height: 1;
}

.mm-game__instructions-esc {
  font-size: clamp(0.75rem, 2vw, 1rem);
  font-weight: 700;
  font-family: var(--font-playful);
  color: #fff;
  text-shadow: var(--shadow-text-game);
  letter-spacing: 0.08em;
  line-height: 1;
}

.mm-penalty-enter-active {
  animation: mm-penalty-float 1.5s ease-out forwards;
}

.mm-penalty-leave-active {
  display: none;
}

@keyframes mm-penalty-float {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(0);
  }

  15% {
    opacity: 1;
    transform: translateX(-50%) translateY(-8px);
  }

  70% {
    opacity: 1;
    transform: translateX(-50%) translateY(-20px);
  }

  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-36px);
  }
}

.mm-instructions-leave-active {
  transition: opacity 0.6s ease;
}

.mm-instructions-leave-to {
  opacity: 0;
}
</style>
