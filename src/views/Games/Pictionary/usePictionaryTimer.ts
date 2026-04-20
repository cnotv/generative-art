import { ref, watch, onUnmounted, type Ref } from 'vue'
import type { PictionaryPhase, PictionaryRound } from '@/stores/pictionary'

const TICK_INTERVAL_MS = 250

type PictionaryTimerOptions = {
  round: Ref<PictionaryRound>
  phase: Ref<PictionaryPhase>
  intermissionEndsAt: Ref<number | null>
  isHost: Ref<boolean>
  isDrawer: Ref<boolean>
  onRoundTimeout: () => void
  onChoiceTimeout: (choices: string[]) => void
}

type PictionaryTimerReturn = {
  timeLeft: Ref<number>
  intermissionLeft: Ref<number>
}

/**
 * Manage countdown timers for round and intermission phases.
 * @param options - Reactive sources and timeout callbacks.
 * @returns Reactive timeLeft and intermissionLeft refs.
 */
export const usePictionaryTimer = (options: PictionaryTimerOptions): PictionaryTimerReturn => {
  const timeLeft = ref(0)
  const intermissionLeft = ref(0)
  let tickInterval: ReturnType<typeof setInterval> | null = null
  let intermissionTickInterval: ReturnType<typeof setInterval> | null = null

  watch(options.intermissionEndsAt, (endsAt) => {
    if (intermissionTickInterval) clearInterval(intermissionTickInterval)
    if (!endsAt) {
      intermissionLeft.value = 0
      return
    }
    const update = (): void => {
      intermissionLeft.value = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
    }
    update()
    intermissionTickInterval = setInterval(update, TICK_INTERVAL_MS)
  })

  watch(
    () => options.round.value.endsAt,
    (endsAt) => {
      if (tickInterval) clearInterval(tickInterval)
      if (!endsAt) return
      tickInterval = setInterval(() => {
        timeLeft.value = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
        if (timeLeft.value !== 0) return
        if (options.phase.value === 'drawing' && options.isHost.value) {
          options.onRoundTimeout()
        } else if (options.phase.value === 'choosing' && options.isDrawer.value) {
          const choices = options.round.value.choices
          if (choices.length > 0) {
            options.onChoiceTimeout(choices)
          }
        }
      }, TICK_INTERVAL_MS)
    }
  )

  onUnmounted(() => {
    if (tickInterval) clearInterval(tickInterval)
    if (intermissionTickInterval) clearInterval(intermissionTickInterval)
  })

  return { timeLeft, intermissionLeft }
}
