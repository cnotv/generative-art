<script setup lang="ts">
import { computed } from 'vue'
import { Slider } from '@/components/ui/slider'
import { STRUDEL_TIMELINE_MAX_LOOP_BARS, STRUDEL_TIMELINE_SEEK_STEP } from '../config'

const props = defineProps<{
  playheadCycle: number
  timelineBars: number
  cyclesPerSecond: number
  loopBars: number | null
  loopMeasured: boolean
}>()

const emit = defineEmits<{
  seek: [cycle: number]
}>()

const barStarts = computed(() =>
  Array.from({ length: props.timelineBars }, (_, barIndex) => ({
    barNumber: barIndex + 1,
    offsetPercent: (barIndex / props.timelineBars) * 100
  }))
)

const formatSeconds = (cycles: number): string => (cycles / props.cyclesPerSecond).toFixed(1)

const loopLabel = computed(() => {
  if (!props.loopMeasured) {
    return 'Loop length shows once the pattern plays'
  }
  if (props.loopBars === null) {
    return `No repeat within ${STRUDEL_TIMELINE_MAX_LOOP_BARS} bars`
  }
  return props.loopBars === 1 ? 'Loops every bar' : `Loops every ${props.loopBars} bars`
})

const onSliderMoved = (values: number[] | undefined): void => {
  const [cycle] = values ?? []
  if (cycle !== undefined) {
    emit('seek', cycle)
  }
}
</script>

<template>
  <section class="strudel-timeline" aria-label="Timeline">
    <p class="strudel-timeline__readout">
      <span>Bar {{ Math.floor(playheadCycle) + 1 }} of {{ timelineBars }}</span>
      <span>{{ formatSeconds(playheadCycle) }} s of {{ formatSeconds(timelineBars) }} s</span>
      <span class="strudel-timeline__loop">{{ loopLabel }}</span>
    </p>
    <Slider
      :model-value="[playheadCycle]"
      :min="0"
      :max="timelineBars"
      :step="STRUDEL_TIMELINE_SEEK_STEP"
      label="Play position"
      @update:model-value="onSliderMoved"
    />
    <ol class="strudel-timeline__bars" aria-hidden="true">
      <li
        v-for="barStart in barStarts"
        :key="barStart.barNumber"
        class="strudel-timeline__bar"
        :style="{ left: `${barStart.offsetPercent}%` }"
      >
        {{ barStart.barNumber }}
      </li>
    </ol>
  </section>
</template>

<style scoped>
.strudel-timeline {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.strudel-timeline__readout {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1) var(--spacing-4);
  margin: 0;
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
  color: var(--color-foreground);
}

.strudel-timeline__loop {
  margin-left: auto;
  color: var(--color-muted-foreground);
}

.strudel-timeline__bars {
  position: relative;
  height: var(--spacing-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.strudel-timeline__bar {
  position: absolute;
  top: 0;
  padding-left: var(--spacing-1);
  border-left: 1px solid var(--color-border);
  font-size: var(--font-size-2xs);
  line-height: 1;
  color: var(--color-muted-foreground);
}
</style>
