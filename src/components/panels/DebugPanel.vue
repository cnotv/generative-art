<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { TimeRangeValue } from '@/stores/perfMetrics'
import { useRoute } from 'vue-router'
import GenericPanel from './GenericPanel.vue'
import PerfChart from './PerfChart.vue'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from '@/components/ui/accordion'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { usePerfMetricsStore, TIME_RANGE_OPTIONS } from '@/stores/perfMetrics'
import { usePanelsStore } from '@/stores/panels'

const perfStore = usePerfMetricsStore()
const panelsStore = usePanelsStore()
const route = useRoute()

watch(
  () => route.name,
  () => perfStore.resetHistory()
)

let frameCount = 0
let lastTime = performance.now()
let lastFrameTime = performance.now()
let animationFrameId: number | null = null

const currentFps = ref(0)
const currentMs = ref(0)
const showCharts = ref(true)
const timeRange = ref<string>(TIME_RANGE_OPTIONS[0].value)

const chartData = computed(() => perfStore.chartSnapshots[timeRange.value as TimeRangeValue])

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
  const elapsed = now - lastTime
  if (elapsed >= 1000) {
    currentFps.value = Math.round((frameCount * 1000) / elapsed)
    frameCount = 0
    lastTime += 1000
    perfStore.recordSnapshot()
  }

  perfStore.tick(currentFps.value, currentMs.value)
  animationFrameId = requestAnimationFrame(updateStats)
}

const stopLoop = () => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

const startLoop = () => {
  if (animationFrameId === null) {
    lastTime = performance.now()
    lastFrameTime = performance.now()
    frameCount = 0
    updateStats()
  }
}

watch(
  () => panelsStore.isDebugOpen,
  (open) => {
    if (open) startLoop()
    else stopLoop()
  }
)

onMounted(() => {
  if (panelsStore.isDebugOpen) startLoop()
})

onUnmounted(() => {
  stopLoop()
})
</script>

<template>
  <GenericPanel panel-type="debug" side="right" title="Debug">
    <Accordion type="multiple" :default-value="['stats']" class="w-full">
      <AccordionItem value="stats">
        <AccordionTrigger class="text-sm font-medium py-2">Performance Stats</AccordionTrigger>
        <AccordionContent>
          <div class="debug-panel__chart-controls">
            <label class="debug-panel__chart-label">
              <Checkbox v-model="showCharts" />
              <span>Chart</span>
            </label>
            <Select
              v-if="showCharts"
              v-model="timeRange"
              :options="[...TIME_RANGE_OPTIONS]"
              class="debug-panel__time-range"
            />
          </div>
          <div class="debug-panel__stats">
            <div class="debug-panel__stat-group">
              <div class="debug-panel__stat">
                <span class="debug-panel__stat-label">FPS</span>
                <span
                  class="debug-panel__stat-value"
                  :class="`debug-panel__stat-value--${fpsColor}`"
                >
                  {{ perfStore.fps }}
                </span>
              </div>
              <PerfChart
                v-if="showCharts"
                :values="chartData.fps"
                :color="`var(--color-perf-${fpsColor})`"
              />
            </div>
            <div class="debug-panel__stat-group">
              <div class="debug-panel__stat">
                <span class="debug-panel__stat-label">Frame ms</span>
                <span
                  class="debug-panel__stat-value"
                  :class="`debug-panel__stat-value--${msColor}`"
                >
                  {{ perfStore.ms }}
                </span>
              </div>
              <PerfChart
                v-if="showCharts"
                :values="chartData.ms"
                :color="`var(--color-perf-${msColor})`"
              />
            </div>
            <div class="debug-panel__stat-group">
              <div class="debug-panel__stat">
                <span class="debug-panel__stat-label">Draw calls</span>
                <span
                  class="debug-panel__stat-value"
                  :class="`debug-panel__stat-value--${drawCallsColor}`"
                >
                  {{ perfStore.drawCalls }}
                </span>
              </div>
              <PerfChart
                v-if="showCharts"
                :values="chartData.drawCalls"
                :color="`var(--color-perf-${drawCallsColor})`"
              />
            </div>
            <div class="debug-panel__stat-group">
              <div class="debug-panel__stat">
                <span class="debug-panel__stat-label">Triangles</span>
                <span
                  class="debug-panel__stat-value"
                  :class="`debug-panel__stat-value--${trianglesColor}`"
                >
                  {{ formatTriangles }}
                </span>
              </div>
              <PerfChart
                v-if="showCharts"
                :values="chartData.triangles"
                :color="`var(--color-perf-${trianglesColor})`"
              />
            </div>
            <div v-if="perfStore.heapMB > 0" class="debug-panel__stat-group">
              <div class="debug-panel__stat">
                <span class="debug-panel__stat-label">Heap MB</span>
                <span
                  class="debug-panel__stat-value"
                  :class="`debug-panel__stat-value--${heapColor}`"
                >
                  {{ perfStore.heapMB }}
                </span>
              </div>
              <PerfChart
                v-if="showCharts"
                :values="chartData.heapMB"
                :color="`var(--color-perf-${heapColor})`"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <slot />
  </GenericPanel>
</template>

<style scoped>
.debug-panel__chart-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding-bottom: var(--spacing-2);
}

.debug-panel__chart-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: var(--color-foreground);
  cursor: pointer;
  white-space: nowrap;
}

.debug-panel__time-range {
  flex: 1;
  font-size: var(--font-size-xs);
}

.debug-panel__stats {
  display: grid;
  gap: var(--spacing-1);
  padding-bottom: var(--spacing-1);
}

.debug-panel__stat-group {
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  overflow: hidden;
}

.debug-panel__stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
