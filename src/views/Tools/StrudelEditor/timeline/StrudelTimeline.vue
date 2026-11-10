<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Disc3, Footprints, Pause, Play, Repeat, Square, Timer } from 'lucide-vue-next'
import IconButton from '@/components/IconButton.vue'
import { Slider } from '@/components/ui/slider'
import { Toggle } from '@/components/ui/toggle'
import { STRUDEL_TIMELINE_MIN_CYCLE_WIDTH, STRUDEL_TIMELINE_SEEK_STEP } from '../config'
import { useTouchSeek } from './useTouchSeek'

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

const scrollerElement = ref<HTMLElement | null>(null)
const hiddenBefore = ref(false)
const hiddenAfter = ref(false)
let resizeObserver: ResizeObserver | null = null

// The fades at either end are the clue that the song goes on past the edge.
const readHiddenEnds = (): void => {
  const scroller = scrollerElement.value
  if (scroller === null) {
    return
  }
  hiddenBefore.value = scroller.scrollLeft > 0
  hiddenAfter.value = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1
}

onMounted(() => {
  const scroller = scrollerElement.value
  if (scroller === null || typeof ResizeObserver === 'undefined') {
    return
  }
  resizeObserver = new ResizeObserver(readHiddenEnds)
  resizeObserver.observe(scroller)
})

onBeforeUnmount(() => resizeObserver?.disconnect())

watch(() => props.timelineBars, readHiddenEnds, { flush: 'post' })

const playPauseLabel = computed(() => (props.isPlaying ? 'Pause' : 'Play from here'))
const loopLabel = computed(() => (props.loopEnabled ? 'Loop on' : 'Loop off'))

const onPlayPausePressed = (): void => {
  if (props.isPlaying) {
    emit('pause')
    return
  }
  emit('play')
}

const onSliderMoved = (values: number[] | undefined): void => {
  const [cycle] = values ?? []
  if (cycle !== undefined) {
    emit('seek', cycle)
  }
}

const trackElement = ref<HTMLElement | null>(null)
const touchSeek = useTouchSeek(
  trackElement,
  () => props.timelineBars,
  (cycle) => emit('seek', cycle)
)

const trackStyle = computed(() => ({
  width: `max(100%, ${props.timelineBars * STRUDEL_TIMELINE_MIN_CYCLE_WIDTH}px)`,
  '--timeline-cycles': props.timelineBars,
  '--timeline-steps-per-cycle': props.stepsPerCycle
}))

const cycleReadout = computed(() => `${Math.floor(props.playheadCycle) + 1}/${props.timelineBars}`)
const stepReadout = computed(() => {
  const fractionOfCycle = props.playheadCycle - Math.floor(props.playheadCycle)
  return `${Math.floor(fractionOfCycle * props.stepsPerCycle) + 1}/${props.stepsPerCycle}`
})
const timeReadout = computed(() => `${(props.playheadCycle / props.cyclesPerSecond).toFixed(1)}s`)
</script>

<template>
  <section class="strudel-timeline" aria-label="Timeline">
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
        <Repeat aria-hidden="true" />
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
    <div
      ref="scrollerElement"
      class="strudel-timeline__scroller"
      :class="{
        'strudel-timeline__scroller--hidden-before': hiddenBefore,
        'strudel-timeline__scroller--hidden-after': hiddenAfter
      }"
      @scroll.passive="readHiddenEnds"
    >
      <!-- The track hosts the cycle and step marks: scoped styles never reach the slider's
           radix root, so the marks cannot live on the slider itself. -->
      <div
        ref="trackElement"
        class="strudel-timeline__track"
        :style="trackStyle"
        @pointerdown.capture="touchSeek.onPointerDown"
        @pointermove.capture="touchSeek.onPointerMove"
        @pointerup.capture="touchSeek.onPointerUp"
        @pointercancel.capture="touchSeek.onPointerCancel"
      >
        <Slider
          :model-value="[playheadCycle]"
          :min="0"
          :max="timelineBars"
          :step="STRUDEL_TIMELINE_SEEK_STEP"
          label="Playhead"
          orientation="horizontal"
          variant="playhead"
          @update:model-value="onSliderMoved"
        />
      </div>
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

.strudel-timeline__scroller {
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  touch-action: pan-x;
  padding-block: var(--spacing-1);
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.strudel-timeline__scroller--hidden-before {
  mask-image: linear-gradient(to right, transparent, black var(--spacing-8));
}

.strudel-timeline__scroller--hidden-after {
  mask-image: linear-gradient(to left, transparent, black var(--spacing-8));
}

.strudel-timeline__scroller--hidden-before.strudel-timeline__scroller--hidden-after {
  mask-image: linear-gradient(
    to right,
    transparent,
    black var(--spacing-8),
    black calc(100% - var(--spacing-8)),
    transparent
  );
}

/* A new stacking context, so the marks drawn at z-index -1 sit under the slider's line and
   playhead but above whatever is behind the timeline. */
.strudel-timeline__track {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  height: var(--spacing-5);
}

/* A taller line on every cycle and a short tick on every step, from custom properties set on
   this same element. */
.strudel-timeline__track::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 0;
  pointer-events: none;
  background-image:
    repeating-linear-gradient(
      to right,
      var(--color-muted-foreground) 0 1px,
      transparent 1px calc(100% / var(--timeline-cycles))
    ),
    repeating-linear-gradient(
      to right,
      var(--color-border) 0 1px,
      transparent 1px calc(100% / (var(--timeline-cycles) * var(--timeline-steps-per-cycle)))
    );
  background-size:
    100% 100%,
    100% 50%;
  background-position:
    0 0,
    0 50%;
  background-repeat: no-repeat;
}
</style>
