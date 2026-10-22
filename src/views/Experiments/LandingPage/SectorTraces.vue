<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { buildSectorTraces } from './sectorTraces'
import { SECTOR_TRACE_ORIGIN_RISE, SECTOR_ARROW_GAP } from './config'
import type { SectorTrace, TracePoint } from './types'

const props = defineProps<{
  /** The list of sectors the arrows lead to; each item's first child is its avatar. */
  list: HTMLElement | null
}>()

const traces = ref<SectorTrace[]>([])
const origin = ref({ x: 0, y: -SECTOR_TRACE_ORIGIN_RISE })
let resizeObserver: ResizeObserver | null = null

// Offsets rather than bounding boxes: the sectors slide in as they scroll into view, and a box
// measured mid-slide would leave every arrow short of its avatar. The slide's transform also makes
// each sector the offset parent of its avatar, so offsets are summed up to the section.
const offsetWithin = (element: HTMLElement, container: Element): TracePoint => {
  const parent = element.offsetParent
  const above =
    parent instanceof HTMLElement && parent !== container
      ? offsetWithin(parent, container)
      : { x: 0, y: 0 }
  return { x: element.offsetLeft + above.x, y: element.offsetTop + above.y }
}

const measure = (): void => {
  const list = props.list
  const section = list?.offsetParent
  if (!list || !section) return
  origin.value = {
    x: offsetWithin(list, section).x + list.offsetWidth / 2,
    y: -SECTOR_TRACE_ORIGIN_RISE
  }
  const targets = [...list.children].flatMap(({ firstElementChild: avatar }) => {
    if (!(avatar instanceof HTMLElement)) return []
    const corner = offsetWithin(avatar, section)
    return [{ x: corner.x + avatar.offsetWidth / 2, y: corner.y }]
  })
  traces.value = buildSectorTraces(origin.value, targets, SECTOR_ARROW_GAP)
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
        refX="5"
        refY="5"
        markerWidth="10"
        markerHeight="10"
        markerUnits="userSpaceOnUse"
        orient="auto"
      >
        <path class="sector-traces__arrow" d="M 0 0 L 10 5 L 0 10 Z" />
      </marker>
    </defs>
    <circle class="sector-traces__node" :cx="origin.x" :cy="origin.y" r="4" />
    <path
      v-for="(trace, index) in traces"
      :key="index"
      class="sector-traces__line"
      :d="trace.path"
      marker-end="url(#sector-traces-arrow)"
    />
  </svg>
</template>

<style scoped>
/* Dotted arrows from the dock under the city to every sector, drawn behind the avatars. */
.sector-traces {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

/* Round caps on zero-length dashes draw dots. */
.sector-traces__line {
  fill: none;
  stroke: var(--color-lcd-dim);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-dasharray: 0 9;
}

.sector-traces__node,
.sector-traces__arrow {
  fill: var(--color-lcd-dim);
}

@media (prefers-reduced-motion: no-preference) {
  .sector-traces__line {
    animation: sector-traces-flow 0.9s linear infinite;
  }
}

/* The dots march from the city towards the sectors, one dot spacing per cycle. */
@keyframes sector-traces-flow {
  to {
    stroke-dashoffset: -9;
  }
}
</style>
