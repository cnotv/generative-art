<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { assetsRelease } from '@webgamekit/threejs'
import { SKILL_AREAS, SKILLS_CITY_MODEL } from './config'
import { createCityStage, fitCityCamera, pickDistrict, updateDistrictLift } from './cityStage'
import type { SkillsCityStage } from './types'

const canvas = ref<HTMLCanvasElement | null>(null)
const hovered = ref<string | null>(null)
const labelPosition = ref({ x: 0, y: 0 })
const hoveredArea = computed(() => SKILL_AREAS.find(({ district }) => district === hovered.value))

let stage: SkillsCityStage | null = null
let frameId = 0
let resizeObserver: ResizeObserver | null = null

// The city is still, so it only renders while a district is moving or the canvas changes size.
const renderFrame = (): void => {
  if (!stage) return
  const isMoving = updateDistrictLift(stage, hovered.value)
  stage.renderer.render(stage.scene, stage.camera)
  frameId = isMoving ? requestAnimationFrame(renderFrame) : 0
}

const requestRender = (): void => {
  if (!frameId) frameId = requestAnimationFrame(renderFrame)
}

const resizeStage = (): void => {
  if (!stage || !canvas.value) return
  const { clientWidth, clientHeight } = canvas.value
  stage.renderer.setSize(clientWidth, clientHeight, false)
  fitCityCamera(stage.camera, stage.outline, clientWidth / clientHeight)
  requestRender()
}

const onPointerMove = (event: PointerEvent): void => {
  if (!stage || !canvas.value) return
  const bounds = canvas.value.getBoundingClientRect()
  labelPosition.value = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  const district = pickDistrict(stage, event.clientX, event.clientY)
  if (district === hovered.value) return
  hovered.value = district
  requestRender()
}

const onPointerLeave = (): void => {
  hovered.value = null
  requestRender()
}

onMounted(async () => {
  if (!canvas.value) return
  stage = await createCityStage(canvas.value)
  resizeObserver = new ResizeObserver(resizeStage)
  resizeObserver.observe(canvas.value)
  resizeStage()
})

onUnmounted(() => {
  cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  stage?.renderer.dispose()
  stage = null
  assetsRelease(`${import.meta.env.BASE_URL}${SKILLS_CITY_MODEL}`)
})
</script>

<template>
  <div class="skills-city">
    <canvas
      ref="canvas"
      class="skills-city__canvas"
      :class="{ 'skills-city__canvas--pointing': hoveredArea }"
      role="img"
      aria-label="A small city with one district for each area of work"
      @pointermove="onPointerMove"
      @pointerdown="onPointerMove"
      @pointerleave="onPointerLeave"
    />
    <div
      v-if="hoveredArea"
      class="skills-city__label"
      :style="{ left: `${labelPosition.x}px`, top: `${labelPosition.y}px` }"
    >
      <p class="skills-city__label-title">{{ hoveredArea.title }}</p>
      <p class="skills-city__label-line">{{ hoveredArea.line }}</p>
    </div>
    <ul class="sr-only">
      <li v-for="area in SKILL_AREAS" :key="area.title">{{ area.title }}: {{ area.line }}</li>
    </ul>
  </div>
</template>

<style scoped>
.skills-city {
  position: relative;
}

/* App.vue positions every canvas absolutely for full-screen scenes; this one sits in the flow. */
.skills-city__canvas {
  position: relative;
  display: block;
  width: 100%;
  height: clamp(12rem, 50vw, 32rem);
  touch-action: pan-y;
}

.skills-city__canvas--pointing {
  cursor: pointer;
}

.skills-city__label {
  position: absolute;
  transform: translate(-50%, calc(-100% - var(--spacing-4)));
  max-width: 18rem;
  padding: var(--spacing-3) var(--spacing-4);
  border: var(--spacing-px) solid var(--color-canvas-overlay-border);
  background-color: var(--color-canvas-overlay-surface);
  pointer-events: none;
  font-family: var(--font-mono);
}

.skills-city__label-title,
.skills-city__label-line {
  margin: 0;
}

.skills-city__label-title {
  margin-bottom: var(--spacing-1);
  color: var(--color-canvas-overlay-accent);
  font-size: var(--font-size-sm);
}

.skills-city__label-line {
  color: var(--color-canvas-overlay-muted);
  font-size: var(--font-size-xs);
  line-height: 1.6;
}
</style>
