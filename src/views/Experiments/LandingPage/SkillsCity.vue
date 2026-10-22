<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { assetsRelease } from '@webgamekit/threejs'
import { SKILL_AREAS, SKILLS_CITY_MODEL, OWNER_SUMMARY } from './config'
import {
  createCityStage,
  fitCityCamera,
  getScreenRect,
  pickDistrict,
  updateDistrictLift,
  updateCityMotion
} from './cityStage'
import type { SkillsCityStage, CanvasRect } from './types'

const MILLISECONDS_PER_SECOND = 1000
const PERCENT = 100

const canvas = ref<HTMLCanvasElement | null>(null)
const hovered = ref<string | null>(null)
const hoveredArea = computed(() => SKILL_AREAS.find(({ district }) => district === hovered.value))
const screenRect = ref<CanvasRect | null>(null)
const screenStyle = computed(() =>
  screenRect.value
    ? Object.fromEntries(
        Object.entries(screenRect.value).map(([edge, fraction]) => [edge, `${fraction * PERCENT}%`])
      )
    : undefined
)

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
  screenRect.value = stage.screen ? getScreenRect(stage.camera, stage.screen) : null
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
    <!-- Laid over the blank screen on the sign behind the city, so its text stays sharp. -->
    <div v-if="screenStyle" class="skills-city__lcd" :style="screenStyle" aria-hidden="true">
      <!-- Keyed on the district so the typing effect replays for every new one. -->
      <div :key="hovered ?? 'idle'" class="skills-city__lcd-screen">
        <!-- The signs in the city already name the district, so only a phone's screen needs it. -->
        <template v-if="hoveredArea">
          <p class="skills-city__lcd-title skills-city__lcd-title--district">
            {{ hoveredArea.title }}
          </p>
          <p class="skills-city__lcd-line skills-city__lcd-line--district">
            {{ hoveredArea.line }}
          </p>
        </template>
        <template v-else>
          <p class="skills-city__lcd-title">What I work on</p>
          <p class="skills-city__lcd-line">{{ OWNER_SUMMARY }}</p>
        </template>
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

/* An LED display on the sign's screen: the sign's own metal frame is its bezel. */
.skills-city__lcd {
  position: absolute;
  container-type: size;
  pointer-events: none;
}

.skills-city__lcd-screen {
  display: flex;
  height: 100%;
  flex-direction: column;
  justify-content: center;
  padding: 0 var(--spacing-4);
  background-color: var(--color-lcd-surface);
  background-image: var(--lcd-scanlines);
  font-family: var(--font-mono);
  text-align: center;
  text-transform: uppercase;
  text-shadow: var(--shadow-lcd-glow);
}

.skills-city__lcd-title,
.skills-city__lcd-line {
  margin: 0;
}

.skills-city__lcd-title {
  color: var(--color-lcd-text);
  font-size: var(--font-size-lcd-title);
  letter-spacing: 0.12em;
}

.skills-city__lcd-line {
  margin-top: var(--spacing-1);
  color: var(--color-lcd-text);
  font-size: var(--font-size-lcd-line);
  letter-spacing: 0.08em;
  line-height: 1.5;
}

.skills-city__lcd-title--district {
  display: none;
}

.skills-city__lcd-line--district {
  margin-top: 0;
  font-size: var(--font-size-lcd-description);
}

@media (prefers-reduced-motion: no-preference) {
  .skills-city__lcd-title,
  .skills-city__lcd-line {
    animation: skills-city-type 0.7s steps(28) both;
  }

  .skills-city__lcd-line {
    animation-delay: 0.25s;
  }

  .skills-city__lcd-line--district {
    animation-delay: 0s;
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

/* On a phone the screen is too small for a sentence and the signs are too small to read, so it
   shows the name instead, larger. */
@container (width < 15rem) {
  .skills-city__lcd-line {
    display: none;
  }

  .skills-city__lcd-title,
  .skills-city__lcd-title--district {
    display: block;
    font-size: var(--font-size-lcd-title-compact);
  }
}
</style>
