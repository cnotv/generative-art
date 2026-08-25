<script setup lang="ts">
import { computed, watch, ref, onMounted, onUnmounted } from 'vue'
import { Select } from '@/components/ui/select'
import type { EasingName } from './types'

interface Preset {
  name: EasingName
  label: string
  /** CSS cubic-bezier control point 1 */
  x1: number
  y1: number
  /** CSS cubic-bezier control point 2 */
  x2: number
  y2: number
}

const PRESETS: Preset[] = [
  { name: 'linear', label: 'Linear', x1: 0.5, y1: 0.5, x2: 0.5, y2: 0.5 },
  { name: 'ease-in', label: 'Ease In', x1: 0.42, y1: 0, x2: 1.0, y2: 1.0 },
  { name: 'ease-out', label: 'Ease Out', x1: 0, y1: 0, x2: 0.58, y2: 1.0 },
  { name: 'ease-in-out', label: 'Ease In/Out', x1: 0.42, y1: 0, x2: 0.58, y2: 1.0 },
  { name: 'ease-in-back', label: 'In Back', x1: 0.36, y1: 0, x2: 0.66, y2: -0.56 },
  { name: 'ease-out-back', label: 'Out Back', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1.0 }
]

const options = PRESETS.map((p) => ({ value: p.name, label: p.label }))

const props = defineProps<{ modelValue: EasingName }>()
const emit = defineEmits<{ 'update:modelValue': [value: EasingName] }>()

// Internal mutable control points — synced from modelValue, also draggable
const cp1 = ref({ x: 0.5, y: 0.5 })
const cp2 = ref({ x: 0.5, y: 0.5 })
const svgReference = ref<SVGSVGElement | null>(null)
const dragging = ref<1 | 2 | null>(null)

const syncFromPreset = (name: EasingName) => {
  const p = PRESETS.find((p) => p.name === name) ?? PRESETS[0]
  cp1.value = { x: p.x1, y: p.y1 }
  cp2.value = { x: p.x2, y: p.y2 }
}

// Ignored while dragging: the drag emits its own value, and syncing from it would snap the
// handle back to the preset's canonical shape under the pointer.
watch(
  () => props.modelValue,
  (name) => {
    if (!dragging.value) syncFromPreset(name)
  },
  { immediate: true }
)

// SVG coordinate system:
// viewBox "-6 -26 112 152" → chart area [0..100] × [0..100] with room for out-of-range handles
// Bezier x ∈ [0,1] → SVG x ∈ [0,100]
// Bezier y ∈ [0,1] → SVG y ∈ [100,0]  (y-axis flipped)
const toSvgX = (x: number) => x * 100
const toSvgY = (y: number) => (1 - y) * 100
const fromSvgCoords = (svgX: number, svgY: number) => ({
  x: Math.max(0, Math.min(1, svgX / 100)),
  y: Math.max(-1, Math.min(2, 1 - svgY / 100))
})

const p0 = { x: toSvgX(0), y: toSvgY(0) } // (0, 100)
const p3 = { x: toSvgX(1), y: toSvgY(1) } // (100, 0)

const p1svg = computed(() => ({ x: toSvgX(cp1.value.x), y: toSvgY(cp1.value.y) }))
const p2svg = computed(() => ({ x: toSvgX(cp2.value.x), y: toSvgY(cp2.value.y) }))

const curvePath = computed(
  () =>
    `M ${p0.x},${p0.y} C ${p1svg.value.x},${p1svg.value.y} ${p2svg.value.x},${p2svg.value.y} ${p3.x},${p3.y}`
)

/**
 * Where the pointer is in the SVG's own coordinates.
 *
 * Read through the element's screen transform rather than reconstructed from its bounding box
 * and viewBox: any padding, aspect-ratio letterboxing or transform on an ancestor breaks the
 * arithmetic version, and the handle then trails the cursor by a margin that changes with the
 * panel width.
 * @param event The pointer or touch event being tracked
 * @returns The point in viewBox units, or null before the SVG is laid out
 */
const getPointerInSvg = (event: MouseEvent | TouchEvent): { x: number; y: number } | null => {
  const svg = svgReference.value
  const transform = svg?.getScreenCTM()
  if (!svg || !transform) return null
  const source = event instanceof MouseEvent ? event : event.touches[0]
  const point = svg.createSVGPoint()
  point.x = source.clientX
  point.y = source.clientY
  const local = point.matrixTransform(transform.inverse())
  return { x: local.x, y: local.y }
}

/** The preset whose control points sit closest to where the handles have been dragged. */
const nearestPreset = (): Preset =>
  PRESETS.reduce((best, preset) => {
    const distance =
      Math.hypot(preset.x1 - cp1.value.x, preset.y1 - cp1.value.y) +
      Math.hypot(preset.x2 - cp2.value.x, preset.y2 - cp2.value.y)
    const bestDistance =
      Math.hypot(best.x1 - cp1.value.x, best.y1 - cp1.value.y) +
      Math.hypot(best.x2 - cp2.value.x, best.y2 - cp2.value.y)
    return distance < bestDistance ? preset : best
  })

const onMove = (event: MouseEvent | TouchEvent) => {
  if (!dragging.value) return
  const pt = getPointerInSvg(event)
  if (!pt) return
  const coords = fromSvgCoords(pt.x, pt.y)
  if (dragging.value === 1) cp1.value = coords
  else cp2.value = coords
  // Emitted as the handle moves, so the curve being dragged is the curve in effect.
  emit('update:modelValue', nearestPreset().name)
}

const onRelease = () => {
  if (!dragging.value) return
  const settled = nearestPreset()
  dragging.value = null
  // Snapped only once the drag ends, so the handles come to rest on the preset actually chosen.
  syncFromPreset(settled.name)
  emit('update:modelValue', settled.name)
}

onMounted(() => {
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onRelease)
  window.addEventListener('touchmove', onMove, { passive: false })
  window.addEventListener('touchend', onRelease)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onRelease)
  window.removeEventListener('touchmove', onMove)
  window.removeEventListener('touchend', onRelease)
})
</script>

<template>
  <div class="bezier-picker">
    <Select
      :model-value="modelValue"
      :options="options"
      class="h-7 text-xs"
      @update:model-value="emit('update:modelValue', $event as EasingName)"
    />

    <!-- Bezier graph: viewBox shows chart [0..100]×[0..100] with padding for out-of-range handles -->
    <svg
      ref="svgReference"
      class="bezier-picker__svg"
      viewBox="-6 -26 112 152"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Chart border -->
      <rect x="0" y="0" width="100" height="100" class="bezier-picker__border" />
      <!-- Mid guide lines -->
      <line x1="50" y1="0" x2="50" y2="100" class="bezier-picker__mid" />
      <line x1="0" y1="50" x2="100" y2="50" class="bezier-picker__mid" />
      <!-- P0→P1 and P3→P2 guide lines -->
      <line :x1="p0.x" :y1="p0.y" :x2="p1svg.x" :y2="p1svg.y" class="bezier-picker__guide" />
      <line :x1="p3.x" :y1="p3.y" :x2="p2svg.x" :y2="p2svg.y" class="bezier-picker__guide" />
      <!-- Curve -->
      <path :d="curvePath" class="bezier-picker__curve" />
      <!-- Anchor dots at P0 and P3 -->
      <circle :cx="p0.x" :cy="p0.y" r="3" class="bezier-picker__anchor" />
      <circle :cx="p3.x" :cy="p3.y" r="3" class="bezier-picker__anchor" />
      <!-- Draggable control handles P1 and P2 -->
      <circle
        :cx="p1svg.x"
        :cy="p1svg.y"
        r="4.5"
        class="bezier-picker__handle bezier-picker__handle--first"
        @mousedown.prevent="dragging = 1"
        @touchstart.prevent="dragging = 1"
      />
      <circle
        :cx="p2svg.x"
        :cy="p2svg.y"
        r="4.5"
        class="bezier-picker__handle bezier-picker__handle--second"
        @mousedown.prevent="dragging = 2"
        @touchstart.prevent="dragging = 2"
      />
    </svg>
  </div>
</template>

<style scoped>
.bezier-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bezier-picker__svg {
  width: 100%;
  max-width: 132px;
  aspect-ratio: 112 / 152;
  overflow: visible;
  cursor: default;
}

.bezier-picker__border {
  fill: none;
  stroke: var(--color-border);
  stroke-width: 0.5;
}

.bezier-picker__mid {
  stroke: var(--color-border);
  stroke-width: 0.25;
  stroke-dasharray: 3 3;
}

.bezier-picker__guide {
  stroke: var(--color-muted-foreground);
  stroke-width: 0.5;
  stroke-dasharray: 4 3;
  opacity: 0.5;
}

.bezier-picker__curve {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 1.25;
  stroke-linecap: round;
}

.bezier-picker__anchor {
  fill: var(--color-primary);
}

.bezier-picker__handle {
  fill: var(--color-background);
  stroke: var(--color-primary);
  stroke-width: 1;
  cursor: grab;
}

.bezier-picker__handle:active {
  cursor: grabbing;
}

/* Linear puts both control points on the same spot; a filled second handle keeps the two
   tellable apart, and the first stays grabbable underneath. */
.bezier-picker__handle--second {
  fill: var(--color-primary);
  stroke: var(--color-background);
}
</style>
