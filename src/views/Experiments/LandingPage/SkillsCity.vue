<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { assetsRelease } from '@webgamekit/threejs'
import { SKILL_AREAS, SKILLS_CITY_MODEL } from './config'
import { createCityStage, fitCityCamera, pickDistrict, updateDistrictLift } from './cityStage'
import type { SkillsCityStage } from './types'

const canvas = ref<HTMLCanvasElement | null>(null)
const selected = ref<string | null>(null)
const isPointing = ref(false)
const selectedArea = computed(() => SKILL_AREAS.find(({ district }) => district === selected.value))

let stage: SkillsCityStage | null = null
let frameId = 0
let resizeObserver: ResizeObserver | null = null

// The city is still, so it only renders while a district is moving or the canvas changes size.
const renderFrame = (): void => {
  if (!stage) return
  const isMoving = updateDistrictLift(stage, selected.value)
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

// The last district pointed at stays selected, so the overlay keeps showing it after the
// pointer leaves the city or the finger lifts.
const onPointerMove = (event: PointerEvent): void => {
  if (!stage) return
  const district = pickDistrict(stage, event.clientX, event.clientY)
  isPointing.value = district !== null
  if (!district || district === selected.value) return
  selected.value = district
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
      :class="{ 'skills-city__canvas--pointing': isPointing }"
      role="img"
      aria-label="A small city with one district for each area of work"
      @pointermove="onPointerMove"
      @pointerdown="onPointerMove"
    />
    <div class="skills-city__overlay" aria-live="polite">
      <template v-if="selectedArea">
        <p class="skills-city__overlay-title">{{ selectedArea.title }}</p>
        <p class="skills-city__overlay-line">{{ selectedArea.line }}</p>
      </template>
      <p v-else class="skills-city__overlay-line">Hover or tap a district</p>
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

.skills-city__overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 18rem;
  min-height: var(--spacing-16);
  box-sizing: border-box;
  padding: var(--spacing-3) var(--spacing-4);
  border: var(--spacing-px) solid var(--color-canvas-overlay-border);
  background-color: var(--color-canvas-overlay-surface);
  pointer-events: none;
  font-family: var(--font-mono);
}

/* On a phone the city is too small to cover, so the overlay sits under it instead. */
@media (width <= 640px) {
  .skills-city__overlay {
    position: static;
    width: auto;
    margin-top: var(--spacing-3);
  }
}

.skills-city__overlay-title,
.skills-city__overlay-line {
  margin: 0;
}

.skills-city__overlay-title {
  margin-bottom: var(--spacing-1);
  color: var(--color-canvas-overlay-accent);
  font-size: var(--font-size-sm);
}

.skills-city__overlay-line {
  color: var(--color-canvas-overlay-muted);
  font-size: var(--font-size-xs);
  line-height: 1.6;
}
</style>
