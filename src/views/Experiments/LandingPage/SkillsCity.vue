<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { assetsRelease } from '@webgamekit/threejs'
import { SKILL_AREAS, SKILLS_CITY_MODEL, LABEL_MAX_HALF_WIDTH, LABEL_EDGE_SHARE } from './config'
import {
  createCityStage,
  fitCityCamera,
  pickDistrict,
  updateDistrictLift,
  updateCityMotion,
  projectDistrictAnchors
} from './cityStage'
import type { SkillsCityStage, DistrictAnchor } from './types'

const MILLISECONDS_PER_SECOND = 1000

const canvas = ref<HTMLCanvasElement | null>(null)
const hovered = ref<string | null>(null)
const anchors = ref<DistrictAnchor[]>([])

const findArea = (district: string) => SKILL_AREAS.find((area) => area.district === district)

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

const resizeStage = (): void => {
  if (!stage || !canvas.value) return
  const { clientWidth, clientHeight } = canvas.value
  stage.renderer.setSize(clientWidth, clientHeight, false)
  fitCityCamera(stage.camera, stage.outline, clientWidth / clientHeight)
  // Keep every label's centre far enough from the edges for the whole label to stay inside.
  const edge = Math.min(LABEL_MAX_HALF_WIDTH, clientWidth * LABEL_EDGE_SHARE)
  anchors.value = projectDistrictAnchors(stage, clientWidth, clientHeight).map((anchor) => ({
    ...anchor,
    x: Math.min(Math.max(anchor.x, edge), clientWidth - edge)
  }))
  requestRender()
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
    <ul class="skills-city__labels">
      <li
        v-for="anchor in anchors"
        :key="anchor.district"
        class="skills-city__label"
        :class="{ 'skills-city__label--active': anchor.district === hovered }"
        :style="{ left: `${anchor.x}px`, top: `${anchor.y}px` }"
        @pointerenter="setHovered(anchor.district)"
        @pointerleave="setHovered(null)"
      >
        <p class="skills-city__label-title">
          <span class="skills-city__label-full">{{ findArea(anchor.district)?.title }}</span>
          <span class="skills-city__label-short">{{ findArea(anchor.district)?.short }}</span>
        </p>
        <p class="skills-city__label-line">{{ findArea(anchor.district)?.line }}</p>
      </li>
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
  height: clamp(14rem, 60vw, 38rem);
  touch-action: pan-y;
}

.skills-city__canvas--pointing {
  cursor: pointer;
}

.skills-city__labels {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Pinned to the top of its district, sitting just above it. */
.skills-city__label {
  position: absolute;
  transform: translate(-50%, calc(-100% - var(--spacing-2)));
  width: max-content;
  max-width: min(11rem, 26vw);
  padding: var(--spacing-1) var(--spacing-2);
  border: var(--spacing-px) solid var(--color-canvas-overlay-border);
  background-color: var(--color-canvas-overlay-scrim);
  font-family: var(--font-mono);
  text-align: center;
}

.skills-city__label--active {
  border-color: var(--color-canvas-overlay-muted);
  background-color: var(--color-canvas-overlay-surface);
}

.skills-city__label-title,
.skills-city__label-line {
  margin: 0;
}

.skills-city__label-short {
  display: none;
}

.skills-city__label-title {
  color: var(--color-canvas-overlay-accent);
  font-size: var(--font-size-sm);
}

.skills-city__label-line {
  margin-top: var(--spacing-0-5);
  color: var(--color-canvas-overlay-muted);
  font-size: var(--font-size-2xs);
  line-height: 1.5;
}

/* On a phone the districts are too close for the descriptions; the titles carry the labels. */
@media (width <= 640px) {
  .skills-city__label {
    padding: var(--spacing-1) var(--spacing-1-5);
  }

  .skills-city__label-title {
    font-size: var(--font-size-2xs);
  }

  .skills-city__label-line,
  .skills-city__label-full {
    display: none;
  }

  .skills-city__label-short {
    display: inline;
  }
}
</style>
