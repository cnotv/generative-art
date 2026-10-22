<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { buildSectorTraces } from './sectorTraces'
import { SECTOR_TRACE_ORIGIN_RISE, SECTOR_TRACE_SPACING, SECTOR_TRACE_STAGGER } from './config'
import type { SectorTrace, TraceCell } from './types'

const props = defineProps<{
  /** The list of sectors the traces lead to; its offset parent is the space they are drawn in. */
  list: HTMLElement | null
}>()

const traces = ref<SectorTrace[]>([])
const origin = ref({ x: 0, y: -SECTOR_TRACE_ORIGIN_RISE })
let resizeObserver: ResizeObserver | null = null

// Offsets rather than bounding boxes: the sectors slide in as they scroll into view, and a box
// measured mid-slide would leave every trace short of its icon.
const measureCell = (list: HTMLElement, item: HTMLElement): TraceCell => {
  const top = list.offsetTop + item.offsetTop
  return {
    left: list.offsetLeft + item.offsetLeft,
    top,
    width: item.offsetWidth,
    iconTop: top + parseFloat(getComputedStyle(item).paddingTop)
  }
}

const measure = (): void => {
  const list = props.list
  if (!list) return
  origin.value = {
    x: list.offsetLeft + list.offsetWidth / 2,
    y: -SECTOR_TRACE_ORIGIN_RISE
  }
  const cells = Array.from(list.children, (item) => measureCell(list, item as HTMLElement))
  const laneGap = parseFloat(getComputedStyle(list).columnGap) / 2
  traces.value = buildSectorTraces(origin.value, cells, { ...SECTOR_TRACE_SPACING, laneGap })
}

watch(
  () => props.list,
  (list) => {
    resizeObserver?.disconnect()
    if (!list) return
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(list)
  },
  { immediate: true }
)

onUnmounted(() => resizeObserver?.disconnect())
</script>

<template>
  <svg class="sector-traces" aria-hidden="true">
    <defs>
      <marker
        id="sector-traces-arrow"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="9"
        markerHeight="9"
        markerUnits="userSpaceOnUse"
        orient="auto"
      >
        <path class="sector-traces__arrow" d="M 0 0 L 10 5 L 0 10 Z" />
      </marker>
    </defs>
    <circle class="sector-traces__node" :cx="origin.x" :cy="origin.y" r="4" />
    <g v-for="(trace, index) in traces" :key="index">
      <path class="sector-traces__line" :d="trace.path" marker-end="url(#sector-traces-arrow)" />
      <path
        class="sector-traces__pulse"
        :d="trace.path"
        pathLength="1"
        :style="{ animationDelay: `${index * SECTOR_TRACE_STAGGER}s` }"
      />
    </g>
  </svg>
</template>

<style scoped>
/* Circuit traces from the city down to every sector, drawn behind the section's content. */
.sector-traces {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.sector-traces__line,
.sector-traces__pulse {
  fill: none;
  stroke-linecap: round;
}

.sector-traces__line {
  stroke: var(--color-canvas-overlay-border);
  stroke-width: 1.5;
}

.sector-traces__pulse {
  stroke: var(--color-lcd-text);
  stroke-width: 2;

  /* One short dash on a path measured as 1 long, with a gap long enough that it never repeats. */
  stroke-dasharray: 0.05 2;
  stroke-dashoffset: 0.05;
  filter: drop-shadow(var(--shadow-lcd-glow));
}

.sector-traces__node,
.sector-traces__arrow {
  fill: var(--color-lcd-dim);
}

@media (prefers-reduced-motion: no-preference) {
  .sector-traces__pulse {
    animation: sector-traces-flow 2.4s linear infinite;
  }
}

/* Each pulse runs from the city into its sector, then waits off the end before going again. */
@keyframes sector-traces-flow {
  80%,
  100% {
    stroke-dashoffset: -1;
  }
}
</style>
