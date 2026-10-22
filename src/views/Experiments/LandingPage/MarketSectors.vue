<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { assetsRelease } from '@webgamekit/threejs'
import SectorTraces from './SectorTraces.vue'
import { createAvatarStage, renderAvatars, toViewportRect } from './avatarStage'
import { PRODUCT_SECTORS, MARKET_AVATARS_MODEL } from './config'
import type { AvatarStage } from './types'

const list = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

let stage: AvatarStage | null = null
let frameId = 0
let resizeObserver: ResizeObserver | null = null

// The avatars stand still, so they are drawn only when the section changes size.
const renderFrame = (): void => {
  frameId = 0
  if (!stage || !canvas.value || !list.value) return
  const canvasBox = canvas.value.getBoundingClientRect()
  // Each item's first child is its circle; the list keeps them in page order.
  const viewports = [...list.value.children].flatMap(({ firstElementChild: circle }) =>
    circle ? [toViewportRect(circle.getBoundingClientRect(), canvasBox)] : []
  )
  renderAvatars(stage, viewports)
}

const resizeStage = (): void => {
  if (!stage || !canvas.value) return
  stage.renderer.setSize(canvas.value.clientWidth, canvas.value.clientHeight, false)
  if (!frameId) frameId = requestAnimationFrame(renderFrame)
}

onMounted(async () => {
  if (!canvas.value) return
  stage = await createAvatarStage(
    canvas.value,
    PRODUCT_SECTORS.map(({ avatar }) => avatar)
  )
  // The component can unmount while the model loads, taking the canvas with it.
  if (!canvas.value) return
  resizeObserver = new ResizeObserver(resizeStage)
  resizeObserver.observe(canvas.value)
})

onUnmounted(() => {
  cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  stage?.renderer.dispose()
  stage = null
  assetsRelease(`${import.meta.env.BASE_URL}${MARKET_AVATARS_MODEL}`)
})
</script>

<template>
  <section class="market-sectors" aria-labelledby="sectors-title">
    <SectorTraces :list="list" />
    <!-- The arrows from the city carry the section; its name stays for screen readers. -->
    <h2 id="sectors-title" class="sr-only">Market knowledge</h2>
    <ul ref="list" class="market-sectors__list">
      <li v-for="sector in PRODUCT_SECTORS" :key="sector.title" class="market-sectors__item">
        <span class="market-sectors__avatar" />
        <span class="market-sectors__title">{{ sector.title }}</span>
      </li>
    </ul>
    <!-- One canvas for all six avatars, each drawn into the part that covers its circle. It comes
         after the list so it paints over the circles. -->
    <canvas ref="canvas" class="market-sectors__canvas" aria-hidden="true" />
  </section>
</template>

<style scoped>
.market-sectors {
  position: relative;
}

/* App.vue positions every canvas absolutely for full-screen scenes; this one covers the section. */
.market-sectors__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.market-sectors__list {
  position: relative;
  display: grid;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(6, 1fr);
  list-style: none;
  gap: var(--spacing-4);
}

/* On a phone the six sit in two staggered rows, so the arrows to the second row pass between
   the avatars of the first instead of through them. */
@media (width <= 640px) {
  .market-sectors__list {
    grid-template-columns: repeat(7, 1fr);
    row-gap: var(--spacing-8);
  }

  .market-sectors__item {
    grid-column-end: span 2;
  }

  .market-sectors__item:nth-child(1) {
    grid-column-start: 1;
  }

  .market-sectors__item:nth-child(2) {
    grid-column-start: 3;
  }

  .market-sectors__item:nth-child(3) {
    grid-column-start: 5;
  }

  .market-sectors__item:nth-child(4) {
    grid-column-start: 2;
  }

  .market-sectors__item:nth-child(5) {
    grid-column-start: 4;
  }

  .market-sectors__item:nth-child(6) {
    grid-column-start: 6;
  }

  .market-sectors__item:nth-child(n + 4) {
    grid-row: 2;
  }
}

.market-sectors__item {
  display: grid;
  justify-items: center;
  align-content: start;
  gap: var(--spacing-2);
  text-align: center;
}

.market-sectors__avatar {
  display: block;
  width: var(--spacing-20);
  height: var(--spacing-20);
}

.market-sectors__item-icon {
  width: var(--spacing-8);
  height: var(--spacing-8);
  color: var(--color-canvas-overlay-accent);
  stroke-width: 1.25;
}

.market-sectors__title {
  color: var(--color-canvas-overlay-muted);
  font-size: var(--font-size-2xs);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
</style>
