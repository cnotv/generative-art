<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { assetsRelease } from '@webgamekit/threejs'
import { SKILL_AREAS, SKILLS_CITY_MODEL } from './config'
import {
  createCityStage,
  fitCityCamera,
  pickDistrict,
  updateDistrictLift,
  updateCityMotion,
  projectDistrictAnchors,
  splitLabelRows
} from './cityStage'
import type { SkillsCityStage, DistrictAnchor } from './types'

const MILLISECONDS_PER_SECOND = 1000

const canvas = ref<HTMLCanvasElement | null>(null)
const hovered = ref<string | null>(null)
const anchors = ref<DistrictAnchor[]>([])
const canvasBox = ref({ top: 0, width: 0, height: 0 })
const rows = computed(() => splitLabelRows(anchors.value))

const findArea = (district: string) => SKILL_AREAS.find((area) => area.district === district)

// Labels sit in equal columns across the full width, so a label's centre is its column's centre.
const columnCentre = (index: number, count: number): number =>
  ((index + 0.5) / count) * canvasBox.value.width

const leaderLines = computed(() => {
  const { top, height } = canvasBox.value
  const toLine =
    (edge: number) => (anchor: DistrictAnchor, index: number, row: DistrictAnchor[]) => ({
      district: anchor.district,
      x1: columnCentre(index, row.length),
      y1: edge,
      x2: anchor.x,
      y2: top + anchor.y
    })
  return [...rows.value.top.map(toLine(top)), ...rows.value.bottom.map(toLine(top + height))]
})

let stage: SkillsCityStage | null = null
let frameId = 0
let isOnScreen = false
let resizeObserver: ResizeObserver | null = null
let visibilityObserver: IntersectionObserver | null = null
const startedAt = performance.now()

// The city animates only while it is on screen; off screen it renders just enough to finish a
// lift and to stay correct after a resize.
const renderFrame = (): void => {
  if (!stage) return
  updateCityMotion(stage, (performance.now() - startedAt) / MILLISECONDS_PER_SECOND)
  const isLifting = updateDistrictLift(stage, hovered.value)
  stage.renderer.render(stage.scene, stage.camera)
  frameId = isOnScreen || isLifting ? requestAnimationFrame(renderFrame) : 0
}

const requestRender = (): void => {
  if (!frameId) frameId = requestAnimationFrame(renderFrame)
}

const resizeStage = async (): Promise<void> => {
  if (!stage || !canvas.value) return
  const { clientWidth, clientHeight } = canvas.value
  stage.renderer.setSize(clientWidth, clientHeight, false)
  fitCityCamera(stage.camera, stage.outline, clientWidth / clientHeight)
  anchors.value = projectDistrictAnchors(stage, clientWidth, clientHeight)
  requestRender()
  // The label rows only take their height once they render, which moves the canvas down.
  await nextTick()
  canvasBox.value = { top: canvas.value.offsetTop, width: clientWidth, height: clientHeight }
}

const setHovered = (district: string | null): void => {
  if (district === hovered.value) return
  hovered.value = district
  requestRender()
}

const onPointerMove = (event: PointerEvent): void => {
  if (stage) setHovered(pickDistrict(stage, event.clientX, event.clientY))
}

onMounted(async () => {
  if (!canvas.value) return
  stage = await createCityStage(canvas.value)
  resizeObserver = new ResizeObserver(resizeStage)
  resizeObserver.observe(canvas.value)
  visibilityObserver = new IntersectionObserver(([entry]) => {
    isOnScreen = entry.isIntersecting
    if (isOnScreen) requestRender()
  })
  visibilityObserver.observe(canvas.value)
  resizeStage()
})

onUnmounted(() => {
  cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  visibilityObserver?.disconnect()
  stage?.renderer.dispose()
  stage = null
  assetsRelease(`${import.meta.env.BASE_URL}${SKILLS_CITY_MODEL}`)
})
</script>

<template>
  <div class="skills-city">
    <ol
      v-for="(row, position) in [rows.top, rows.bottom]"
      :key="position"
      class="skills-city__labels"
      :class="position === 0 ? 'skills-city__labels--top' : 'skills-city__labels--bottom'"
    >
      <li
        v-for="anchor in row"
        :key="anchor.district"
        class="skills-city__label"
        :class="{ 'skills-city__label--active': anchor.district === hovered }"
        @pointerenter="setHovered(anchor.district)"
        @pointerleave="setHovered(null)"
      >
        <p class="skills-city__label-title">{{ findArea(anchor.district)?.title }}</p>
        <p class="skills-city__label-line">{{ findArea(anchor.district)?.line }}</p>
      </li>
    </ol>
    <canvas
      ref="canvas"
      class="skills-city__canvas"
      :class="{ 'skills-city__canvas--pointing': hovered }"
      role="img"
      aria-label="A small city with one district for each area of work"
      @pointermove="onPointerMove"
      @pointerdown="onPointerMove"
      @pointerleave="setHovered(null)"
    />
    <svg class="skills-city__leaders" aria-hidden="true">
      <line
        v-for="line in leaderLines"
        :key="line.district"
        class="skills-city__leader"
        :class="{ 'skills-city__leader--active': line.district === hovered }"
        :x1="line.x1"
        :y1="line.y1"
        :x2="line.x2"
        :y2="line.y2"
      />
    </svg>
  </div>
</template>

<style scoped>
.skills-city {
  position: relative;
  display: grid;
  grid-template-areas:
    'top'
    'city'
    'bottom';
}

.skills-city__labels {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
}

.skills-city__labels--top {
  grid-area: top;
  align-items: end;
}

.skills-city__labels--bottom {
  grid-area: bottom;
  align-items: start;
}

/* App.vue positions every canvas absolutely for full-screen scenes; this one sits in the flow. */
.skills-city__canvas {
  grid-area: city;
  position: relative;
  display: block;
  width: 100%;
  height: clamp(12rem, 40vw, 28rem);
  touch-action: pan-y;
}

.skills-city__canvas--pointing {
  cursor: pointer;
}

.skills-city__label {
  margin: 0 var(--spacing-1);
  padding: var(--spacing-2) var(--spacing-3);
  border: var(--spacing-px) solid var(--color-canvas-overlay-border);
  background-color: var(--color-canvas-overlay-surface);
  font-family: var(--font-mono);
  text-align: center;
}

.skills-city__label--active {
  border-color: var(--color-canvas-overlay-muted);
}

.skills-city__label-title,
.skills-city__label-line {
  margin: 0;
}

.skills-city__label-title {
  color: var(--color-canvas-overlay-accent);
  font-size: var(--font-size-sm);
}

.skills-city__label-line {
  margin-top: var(--spacing-1);
  color: var(--color-canvas-overlay-muted);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.skills-city__leaders {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.skills-city__leader {
  stroke: var(--color-canvas-overlay-border);
  stroke-width: 1;
}

.skills-city__leader--active {
  stroke: var(--color-canvas-overlay-muted);
}

/* On a phone the columns are too narrow for the descriptions; the titles carry the labels. */
@media (width <= 640px) {
  .skills-city__label {
    padding: var(--spacing-1-5);
  }

  .skills-city__label-title {
    font-size: var(--font-size-2xs);
  }

  .skills-city__label-line {
    display: none;
  }
}
</style>
