<script setup lang="ts">
import * as THREE from 'three'
import { ref, onMounted, onUnmounted } from 'vue'
import { BACKDROP_VERTEX_SHADER, BACKDROP_FRAGMENT_SHADER } from './backdropShader'
import {
  BACKDROP_BASE_COLOR,
  BACKDROP_LINE_COLOR,
  BACKDROP_GLOW_COLOR,
  BACKDROP_SCALE,
  BACKDROP_LEVELS,
  BACKDROP_DOT_SPACING,
  BACKDROP_DOT_RADIUS,
  BACKDROP_MAX_PIXEL_RATIO
} from './config'

const MILLISECONDS_PER_SECOND = 1000

const canvas = ref<HTMLCanvasElement | null>(null)

let renderer: THREE.WebGLRenderer | null = null
let frameId = 0
let isOnScreen = false
let resizeObserver: ResizeObserver | null = null
let visibilityObserver: IntersectionObserver | null = null
const startedAt = performance.now()
const isStill = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const uniforms = {
  uTime: { value: 0 },
  uScroll: { value: 0 },
  uPixelRatio: { value: 1 },
  uResolution: { value: new THREE.Vector2() },
  uScale: { value: BACKDROP_SCALE },
  uLevels: { value: BACKDROP_LEVELS },
  uDotSpacing: { value: BACKDROP_DOT_SPACING },
  uDotRadius: { value: BACKDROP_DOT_RADIUS },
  uBase: { value: new THREE.Color(BACKDROP_BASE_COLOR) },
  uLine: { value: new THREE.Color(BACKDROP_LINE_COLOR) },
  uGlow: { value: new THREE.Color(BACKDROP_GLOW_COLOR) }
}
const scene = new THREE.Scene()
const camera = new THREE.Camera()
scene.add(
  new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: BACKDROP_VERTEX_SHADER,
      fragmentShader: BACKDROP_FRAGMENT_SHADER,
      uniforms
    })
  )
)

// The canvas sticks to the top of the screen while its content scrolls past, so the map is
// shifted by however far the content's top has gone above the screen. With motion reduced the
// map stands still and only follows the scroll.
const renderFrame = (): void => {
  const content = canvas.value?.parentElement
  if (!renderer || !content) return
  uniforms.uTime.value = isStill ? 0 : (performance.now() - startedAt) / MILLISECONDS_PER_SECOND
  uniforms.uScroll.value = Math.max(0, -content.getBoundingClientRect().top)
  renderer.render(scene, camera)
  frameId = isOnScreen ? requestAnimationFrame(renderFrame) : 0
}

const requestRender = (): void => {
  if (!frameId) frameId = requestAnimationFrame(renderFrame)
}

const resize = (): void => {
  if (!renderer || !canvas.value) return
  const { clientWidth, clientHeight } = canvas.value
  renderer.setSize(clientWidth, clientHeight, false)
  renderer.getDrawingBufferSize(uniforms.uResolution.value)
  uniforms.uPixelRatio.value = renderer.getPixelRatio()
  requestRender()
}

onMounted(() => {
  const content = canvas.value?.parentElement
  if (!canvas.value || !content) return
  renderer = new THREE.WebGLRenderer({ canvas: canvas.value })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, BACKDROP_MAX_PIXEL_RATIO))
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas.value)
  visibilityObserver = new IntersectionObserver(([entry]) => {
    isOnScreen = entry.isIntersecting
    if (isOnScreen) requestRender()
  })
  visibilityObserver.observe(content)
})

onUnmounted(() => {
  cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  visibilityObserver?.disconnect()
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()
      object.material.dispose()
    }
  })
  renderer?.dispose()
})
</script>

<template>
  <canvas ref="canvas" class="contour-backdrop" aria-hidden="true" />
</template>

<style scoped>
/* Sticks to the screen behind the content it is the first child of, taking up no room. App.vue
   positions every canvas absolutely for full-screen scenes; this one opts back into the flow. */
.contour-backdrop {
  display: block;
  position: sticky;
  top: 0;
  width: 100%;
  height: 100dvh;
  margin-bottom: -100dvh;
  pointer-events: none;
}
</style>
