<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import GenericPanel from './GenericPanel.vue'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from '@/components/ui/accordion'
import { usePerfMetricsStore } from '@/stores/perfMetrics'

const perfStore = usePerfMetricsStore()

let frameCount = 0
let lastTime = performance.now()
let lastFrameTime = performance.now()
let animationFrameId: number | null = null

const currentFps = ref(0)
const currentMs = ref(0)

const fpsColor = computed(() => {
  if (perfStore.fps >= 55) return 'ok'
  if (perfStore.fps >= 30) return 'warn'
  return 'bad'
})

const msColor = computed(() => {
  if (perfStore.ms < 17) return 'ok'
  if (perfStore.ms < 34) return 'warn'
  return 'bad'
})

const drawCallsColor = computed(() => {
  if (perfStore.drawCalls < 100) return 'ok'
  if (perfStore.drawCalls < 500) return 'warn'
  return 'bad'
})

const trianglesColor = computed(() => {
  if (perfStore.triangles < 500_000) return 'ok'
  if (perfStore.triangles < 1_000_000) return 'warn'
  return 'bad'
})

const heapColor = computed(() => {
  if (perfStore.heapMB < 100) return 'ok'
  if (perfStore.heapMB < 500) return 'warn'
  return 'bad'
})

const formatTriangles = computed(() => {
  const count = perfStore.triangles
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}k`
  return String(count)
})

const updateStats = () => {
  const now = performance.now()
  currentMs.value = Math.round(now - lastFrameTime)
  lastFrameTime = now

  frameCount++
  if (now - lastTime >= 1000) {
    currentFps.value = frameCount
    frameCount = 0
    lastTime = now
  }

  perfStore.tick(currentFps.value, currentMs.value)
  animationFrameId = requestAnimationFrame(updateStats)
}

onMounted(() => {
  updateStats()
})

onUnmounted(() => {
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
})
</script>

<template>
  <GenericPanel panel-type="debug" side="right" title="Debug">
    <Accordion type="multiple" :default-value="['stats']" class="w-full">
      <AccordionItem value="stats">
        <AccordionTrigger class="text-sm font-medium py-2">Performance Stats</AccordionTrigger>
        <AccordionContent>
          <div class="debug-panel__stats">
            <div class="debug-panel__stat">
              <span class="debug-panel__stat-label">FPS</span>
              <span class="debug-panel__stat-value" :class="`debug-panel__stat-value--${fpsColor}`">
                {{ perfStore.fps }}
              </span>
            </div>
            <div class="debug-panel__stat">
              <span class="debug-panel__stat-label">Frame ms</span>
              <span class="debug-panel__stat-value" :class="`debug-panel__stat-value--${msColor}`">
                {{ perfStore.ms }}
              </span>
            </div>
            <div class="debug-panel__stat">
              <span class="debug-panel__stat-label">Draw calls</span>
              <span
                class="debug-panel__stat-value"
                :class="`debug-panel__stat-value--${drawCallsColor}`"
              >
                {{ perfStore.drawCalls }}
              </span>
            </div>
            <div class="debug-panel__stat">
              <span class="debug-panel__stat-label">Triangles</span>
              <span
                class="debug-panel__stat-value"
                :class="`debug-panel__stat-value--${trianglesColor}`"
              >
                {{ formatTriangles }}
              </span>
            </div>
            <div v-if="perfStore.heapMB > 0" class="debug-panel__stat">
              <span class="debug-panel__stat-label">Heap MB</span>
              <span
                class="debug-panel__stat-value"
                :class="`debug-panel__stat-value--${heapColor}`"
              >
                {{ perfStore.heapMB }}
              </span>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <slot />
  </GenericPanel>
</template>

<style scoped>
.debug-panel__stats {
  display: grid;
  gap: var(--spacing-1);
  padding-bottom: var(--spacing-1);
}

.debug-panel__stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  padding: var(--spacing-1);
}

.debug-panel__stat-label {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-foreground);
}

.debug-panel__stat-value {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.debug-panel__stat-value--ok {
  color: var(--color-perf-ok);
}

.debug-panel__stat-value--warn {
  color: var(--color-perf-warn);
}

.debug-panel__stat-value--bad {
  color: var(--color-perf-bad);
}
</style>
