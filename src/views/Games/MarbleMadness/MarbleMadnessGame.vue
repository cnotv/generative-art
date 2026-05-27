<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { TIME_PENALTY_FALL } from './config'

const props = defineProps<{
  elapsed: number
  finished: boolean
  penaltyCount: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
defineExpose({ canvas })

const elapsedDisplay = computed((): string => {
  const total = Math.floor(props.elapsed)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
})

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

onMounted(() => {
  window.addEventListener('keydown', hideInstructions, { once: true })
  window.addEventListener('touchstart', hideInstructions, { once: true })
})

onUnmounted(() => {
  window.removeEventListener('keydown', hideInstructions)
  window.removeEventListener('touchstart', hideInstructions)
  if (penaltyTimer) clearTimeout(penaltyTimer)
})
</script>

<template>
  <div class="mm-game">
    <span class="mm-game__time">{{ elapsedDisplay }}</span>

    <Transition name="mm-penalty">
      <span v-if="showPenalty" :key="penaltyCount" class="mm-game__penalty">
        +{{ TIME_PENALTY_FALL }}s
      </span>
    </Transition>

    <Transition name="mm-instructions">
      <div v-if="showInstructions && !finished" class="mm-game__instructions">
        WASD / Arrow keys to roll
      </div>
    </Transition>

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

.mm-game__time {
  position: absolute;
  top: var(--spacing-3);
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--font-size-lg, 1.25rem);
  font-weight: 800;
  color: var(--game-ink);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 4px rgb(0, 0, 0, 0.4);
  z-index: 10;
  white-space: nowrap;
  pointer-events: none;
}

.mm-game__penalty {
  position: absolute;
  top: 70px;
  left: 50%;
  font-size: var(--font-size-2xl, 1.75rem);
  font-weight: 900;
  color: var(--color-danger, #d32f2f);
  pointer-events: none;
  z-index: 20;
  white-space: nowrap;
  text-shadow: 0 2px 6px rgb(0, 0, 0, 0.5);
}

.mm-game__instructions {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg, 1.25rem);
  font-weight: 700;
  color: var(--game-ink);
  text-shadow: 0 2px 8px rgb(0, 0, 0, 0.5);
  pointer-events: none;
  z-index: 15;
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
