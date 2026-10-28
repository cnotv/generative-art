<script setup lang="ts">
import { computed } from 'vue'
import { Pause, Play } from 'lucide-vue-next'
import IconButton from '@/components/IconButton.vue'
import { Slider } from '@/components/ui/slider'
import { STRUDEL_TIMELINE_MAX_LOOP_BARS, STRUDEL_TIMELINE_SEEK_STEP } from '../config'

const props = defineProps<{
  playheadCycle: number
  timelineBars: number
  cyclesPerSecond: number
  loopBars: number | null
  loopMeasured: boolean
  isPlaying: boolean
}>()

const emit = defineEmits<{
  seek: [cycle: number]
  play: []
  pause: []
}>()

const playPauseLabel = computed(() => (props.isPlaying ? 'Pause' : 'Play from here'))

const onPlayPausePressed = (): void => {
  if (props.isPlaying) {
    emit('pause')
    return
  }
  emit('play')
}

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
    <IconButton
      class="strudel-timeline__play-pause"
      size="md"
      variant="outline"
      :title="playPauseLabel"
      :aria-label="playPauseLabel"
      @click="onPlayPausePressed"
    >
      <Pause v-if="isPlaying" aria-hidden="true" />
      <Play v-else aria-hidden="true" />
    </IconButton>
    <p class="strudel-timeline__readout">
      <span>Bar {{ Math.floor(playheadCycle) + 1 }} of {{ timelineBars }}</span>
      <span>{{ formatSeconds(playheadCycle) }} s of {{ formatSeconds(timelineBars) }} s</span>
      <span class="strudel-timeline__loop">{{ loopLabel }}</span>
    </p>
    <Slider
      class="strudel-timeline__track"
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
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  grid-template-areas:
    'play-pause readout'
    'play-pause track'
    '. bars';
  align-items: center;
  gap: var(--spacing-2) var(--spacing-3);
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.strudel-timeline__play-pause {
  grid-area: play-pause;
  border-radius: var(--radius-full);
}

.strudel-timeline__track {
  grid-area: track;
}

.strudel-timeline__readout {
  grid-area: readout;
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
  grid-area: bars;
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
