<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { assetsRelease } from '@webgamekit/threejs'
import { SKILL_AREAS, SKILLS_CITY_MODEL } from './config'
import {
  createCityStage,
  fitCityCamera,
  pickDistrict,
  updateDistrictLift,
  updateCityMotion
} from './cityStage'
import type { SkillsCityStage } from './types'

const MILLISECONDS_PER_SECOND = 1000

const canvas = ref<HTMLCanvasElement | null>(null)
const hovered = ref<string | null>(null)
const hoveredArea = computed(() => SKILL_AREAS.find(({ district }) => district === hovered.value))

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
  // The component can unmount while the model loads, taking the canvas with it.
  if (!canvas.value) return
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
    <div class="skills-city__lcd" aria-hidden="true">
      <!-- Keyed on the district so the typing effect replays for every new one. -->
      <div :key="hovered ?? 'idle'" class="skills-city__lcd-screen">
        <template v-if="hoveredArea">
          <p class="skills-city__lcd-title">{{ hoveredArea.title }}</p>
          <p class="skills-city__lcd-line">{{ hoveredArea.line }}</p>
        </template>
        <p v-else class="skills-city__lcd-idle">Hover a district</p>
      </div>
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
  height: clamp(14rem, 60vw, 38rem);
  touch-action: pan-y;
}

.skills-city__canvas--pointing {
  cursor: pointer;
}

/* An LCD panel in the corner of the city: dark glass, scan lines and glowing text. */
.skills-city__lcd {
  position: absolute;
  top: var(--spacing-2);
  left: 0;
  width: min(20rem, 100%);
  padding: var(--spacing-1-5);
  border: var(--spacing-px) solid var(--color-lcd-border);
  border-radius: var(--spacing-1);
  background-color: var(--color-lcd-bezel);
  pointer-events: none;
}

.skills-city__lcd-screen {
  min-height: var(--spacing-16);
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--spacing-0-5);
  background-color: var(--color-lcd-surface);
  background-image: var(--lcd-scanlines);
  font-family: var(--font-mono);
  text-transform: uppercase;
  text-shadow: var(--shadow-lcd-glow);
}

.skills-city__lcd-title,
.skills-city__lcd-line,
.skills-city__lcd-idle {
  margin: 0;
}

.skills-city__lcd-title {
  color: var(--color-lcd-text);
  font-size: var(--font-size-sm);
  letter-spacing: 0.12em;
}

.skills-city__lcd-line {
  margin-top: var(--spacing-1);
  color: var(--color-lcd-text);
  font-size: var(--font-size-2xs);
  letter-spacing: 0.08em;
  line-height: 1.6;
}

.skills-city__lcd-idle {
  color: var(--color-lcd-dim);
  font-size: var(--font-size-2xs);
  letter-spacing: 0.2em;
}

@media (prefers-reduced-motion: no-preference) {
  .skills-city__lcd-title,
  .skills-city__lcd-line {
    animation: skills-city-type 0.7s steps(28) both;
  }

  .skills-city__lcd-line {
    animation-delay: 0.25s;
  }

  .skills-city__lcd-idle {
    animation: skills-city-blink 1.2s steps(2) infinite;
  }
}

@keyframes skills-city-type {
  from {
    clip-path: inset(0 100% 0 0);
  }

  to {
    clip-path: inset(0);
  }
}

@keyframes skills-city-blink {
  50% {
    opacity: 0.4;
  }
}

/* On a phone the city is too small to cover, so the display sits under it instead. */
@media (width <= 640px) {
  .skills-city__lcd {
    position: static;
    width: auto;
    margin-top: var(--spacing-2);
  }
}
</style>
