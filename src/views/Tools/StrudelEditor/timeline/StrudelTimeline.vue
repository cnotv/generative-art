<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Disc3, Footprints, Pause, Play, Repeat, Square, Timer } from 'lucide-vue-next'
import IconButton from '@/components/IconButton.vue'
import { Slider } from '@/components/ui/slider'
import { Toggle } from '@/components/ui/toggle'
import {
  STRUDEL_TIMELINE_FALLBACK_WIDTH,
  STRUDEL_TIMELINE_MIN_CYCLE_WIDTH,
  STRUDEL_TIMELINE_SEEK_STEP
} from '../config'
import { findSectionIndexForCycle, splitTimelineSections } from './timelineSections'

const props = defineProps<{
  playheadCycle: number
  timelineBars: number
  cyclesPerSecond: number
  /** Beats in one cycle, so the readout can say which step the playhead is on. */
  stepsPerCycle: number
  loopEnabled: boolean
  isPlaying: boolean
}>()

const emit = defineEmits<{
  seek: [cycle: number]
  play: []
  pause: []
  stop: []
  'update:loopEnabled': [enabled: boolean]
}>()

const timelineElement = ref<HTMLElement | null>(null)
const timelineWidth = ref(0)
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const element = timelineElement.value
  if (element === null || typeof ResizeObserver === 'undefined') {
    return
  }
  resizeObserver = new ResizeObserver(([entry]) => {
    timelineWidth.value = entry?.contentRect.width ?? 0
  })
  resizeObserver.observe(element)
})

onBeforeUnmount(() => resizeObserver?.disconnect())

const sections = computed(() =>
  splitTimelineSections(
    props.timelineBars,
    timelineWidth.value || STRUDEL_TIMELINE_FALLBACK_WIDTH,
    STRUDEL_TIMELINE_MIN_CYCLE_WIDTH
  )
)

const playheadSectionIndex = computed(() =>
  findSectionIndexForCycle(sections.value, props.playheadCycle)
)

const playPauseLabel = computed(() => (props.isPlaying ? 'Pause' : 'Play from here'))
const loopLabel = computed(() => (props.loopEnabled ? 'Loop on' : 'Loop off'))

const onPlayPausePressed = (): void => {
  if (props.isPlaying) {
    emit('pause')
    return
  }
  emit('play')
}

const readSectionValue = (sectionIndex: number, startCycle: number): number =>
  sectionIndex === playheadSectionIndex.value ? props.playheadCycle : startCycle

const onSliderMoved = (values: number[] | undefined): void => {
  const [cycle] = values ?? []
  if (cycle !== undefined) {
    emit('seek', cycle)
  }
}

const cycleReadout = computed(() => `${Math.floor(props.playheadCycle) + 1}/${props.timelineBars}`)
const stepReadout = computed(() => {
  const fractionOfCycle = props.playheadCycle - Math.floor(props.playheadCycle)
  return `${Math.floor(fractionOfCycle * props.stepsPerCycle) + 1}/${props.stepsPerCycle}`
})
const timeReadout = computed(() => `${(props.playheadCycle / props.cyclesPerSecond).toFixed(1)}s`)
</script>

<template>
  <section ref="timelineElement" class="strudel-timeline" aria-label="Timeline">
    <div class="strudel-timeline__controls">
      <IconButton
        size="sm"
        variant="ghost"
        :title="playPauseLabel"
        :aria-label="playPauseLabel"
        @click="onPlayPausePressed"
      >
        <Pause v-if="isPlaying" aria-hidden="true" />
        <Play v-else aria-hidden="true" />
      </IconButton>
      <IconButton
        size="sm"
        variant="ghost"
        title="Stop and rewind"
        aria-label="Stop and rewind"
        @click="emit('stop')"
      >
        <Square aria-hidden="true" />
      </IconButton>
      <Toggle
        size="sm"
        :model-value="loopEnabled"
        :title="loopLabel"
        :aria-label="loopLabel"
        @update:model-value="emit('update:loopEnabled', $event)"
      >
        <Repeat class="h-4 w-4" aria-hidden="true" />
      </Toggle>
      <p class="strudel-timeline__readout">
        <span class="strudel-timeline__reading">
          <span title="Cycle" role="img" aria-label="Cycle"><Disc3 aria-hidden="true" /></span>
          {{ cycleReadout }}
        </span>
        <span class="strudel-timeline__reading">
          <span title="Step" role="img" aria-label="Step"><Footprints aria-hidden="true" /></span>
          {{ stepReadout }}
        </span>
        <span class="strudel-timeline__reading">
          <span title="Time" role="img" aria-label="Time"><Timer aria-hidden="true" /></span>
          {{ timeReadout }}
        </span>
      </p>
    </div>
    <!-- The row hosts the cycle and step overlay: scoped styles never reach the slider's
         radix root, so the overlay cannot live on the slider itself. -->
    <div
      v-for="(section, sectionIndex) in sections"
      :key="section.startCycle"
      class="strudel-timeline__track"
      :style="{
        '--timeline-section-cycles': section.endCycle - section.startCycle,
        '--timeline-steps-per-cycle': stepsPerCycle
      }"
    >
      <Slider
        :hide-thumb="sectionIndex !== playheadSectionIndex"
        :model-value="[readSectionValue(sectionIndex, section.startCycle)]"
        :min="section.startCycle"
        :max="section.endCycle"
        :step="STRUDEL_TIMELINE_SEEK_STEP"
        :label="`Cycles ${section.startCycle + 1} to ${section.endCycle}`"
        @update:model-value="onSliderMoved"
      />
    </div>
  </section>
</template>

<style scoped>
.strudel-timeline {
  display: grid;
  gap: var(--spacing-2);
  color: var(--color-muted-foreground);
}

.strudel-timeline__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-2);
}

.strudel-timeline__readout {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-3);
  margin: 0 0 0 auto;
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.strudel-timeline__reading {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
}

.strudel-timeline__reading svg {
  width: 1rem;
  height: 1rem;
}

/* Cycle lines and shorter step ticks are drawn over the slider, through custom properties set
   on this same element. */
.strudel-timeline__track {
  position: relative;
  display: flex;
  align-items: center;
  height: 1.25rem;
}

.strudel-timeline__track::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    repeating-linear-gradient(
      to right,
      transparent 0 calc(100% / var(--timeline-section-cycles) - 1px),
      var(--color-muted-foreground) calc(100% / var(--timeline-section-cycles) - 1px)
        calc(100% / var(--timeline-section-cycles))
    ),
    repeating-linear-gradient(
      to right,
      transparent 0
        calc(100% / (var(--timeline-section-cycles) * var(--timeline-steps-per-cycle)) - 1px),
      var(--color-border)
        calc(100% / (var(--timeline-section-cycles) * var(--timeline-steps-per-cycle)) - 1px)
        calc(100% / (var(--timeline-section-cycles) * var(--timeline-steps-per-cycle)))
    );
  background-size:
    100% 100%,
    100% 40%;
  background-position:
    0 0,
    0 100%;
  background-repeat: no-repeat;
}
</style>
