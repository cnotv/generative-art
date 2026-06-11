<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import GenericPanel from './GenericPanel.vue'
import { Slider } from '@/components/ui/slider'
import { usePanelsStore } from '@/stores/panels'
import { useTimelinePanelStore } from '@/stores/timelinePanel'
import { getTimelineActionSpan, type Timeline } from '@webgamekit/animation'

interface TimelineBar {
  id: string
  name: string
  left: number
  width: number
  lane: number
  action: Timeline
}

/** Greedily assign each bar to the first lane whose previous bar has ended, stacking overlaps */
const assignLanes = (rawBars: Omit<TimelineBar, 'lane'>[]): TimelineBar[] => {
  const sorted = [...rawBars].sort((a, b) => a.left - b.left)
  const result = sorted.reduce<{ bars: TimelineBar[]; laneEnds: number[] }>(
    (accumulator, bar) => {
      const existingLane = accumulator.laneEnds.findIndex((end) => end <= bar.left)
      const lane = existingLane === -1 ? accumulator.laneEnds.length : existingLane
      const laneEnds =
        existingLane === -1
          ? [...accumulator.laneEnds, bar.left + bar.width]
          : accumulator.laneEnds.map((end, index) => (index === lane ? bar.left + bar.width : end))
      return { bars: [...accumulator.bars, { ...bar, lane }], laneEnds }
    },
    { bars: [], laneEnds: [] }
  )
  return result.bars
}

const panelsStore = usePanelsStore()
const timelinePanelStore = useTimelinePanelStore()

const currentFrame = ref(0)
const selectedActionId = ref<string | null>(null)

let animationFrameId: number | null = null

const tick = () => {
  if (timelinePanelStore.source) {
    currentFrame.value = timelinePanelStore.source.getCurrentFrame()
  }
  animationFrameId = requestAnimationFrame(tick)
}

const stopLoop = () => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

const startLoop = () => {
  if (animationFrameId === null) tick()
}

watch(
  () => panelsStore.isTimelineOpen,
  (open) => {
    if (open) startLoop()
    else stopLoop()
  }
)

onMounted(() => {
  if (panelsStore.isTimelineOpen) startLoop()
})

onUnmounted(() => stopLoop())

const frameRate = computed(() => timelinePanelStore.source?.getFrameRate() ?? 1 / 60)
const currentTimeSeconds = computed(() => currentFrame.value * frameRate.value)

// The visible window advances in fixed-size pages, "refreshing" once the cursor reaches the end
const windowStart = computed(() => {
  const window = timelinePanelStore.windowSeconds
  return Math.floor(currentTimeSeconds.value / window) * window
})

const cursorPercent = computed(
  () => ((currentTimeSeconds.value - windowStart.value) / timelinePanelStore.windowSeconds) * 100
)

const bars = computed<TimelineBar[]>(() => {
  const source = timelinePanelStore.source
  if (!source) return []

  const rate = frameRate.value
  const window = timelinePanelStore.windowSeconds
  const rangeStart = windowStart.value
  const rangeEnd = rangeStart + window

  const rawBars = source
    .getTimeline()
    .map((action, index) => {
      const span = getTimelineActionSpan(action)
      return { action, index, startSec: span.start * rate, endSec: span.end * rate }
    })
    .filter(({ startSec, endSec }) => endSec >= rangeStart && startSec <= rangeEnd)
    .map(({ action, index, startSec, endSec }) => {
      const clippedStart = Math.max(startSec, rangeStart)
      const clippedEnd = Math.max(Math.min(endSec, rangeEnd), clippedStart)
      return {
        id: action.id ?? `action-${index}`,
        name: action.name ?? action.category ?? `Action ${index + 1}`,
        left: ((clippedStart - rangeStart) / window) * 100,
        width: Math.max(((clippedEnd - clippedStart) / window) * 100, 1),
        action
      }
    })

  return assignLanes(rawBars)
})

const laneCount = computed(() => Math.max(1, ...bars.value.map((bar) => bar.lane + 1)))

const selectedAction = computed(
  () => bars.value.find((bar) => bar.id === selectedActionId.value)?.action ?? null
)

const toggleSelection = (id: string) => {
  selectedActionId.value = selectedActionId.value === id ? null : id
}

const handleWindowChange = (value: number[]) => {
  timelinePanelStore.setWindowSeconds(value[0])
}

const formatFramesAsSeconds = (frames: number | undefined): string =>
  frames === undefined ? '—' : `${(frames * frameRate.value).toFixed(2)}s`
</script>

<template>
  <GenericPanel panel-type="timeline" side="right" title="Timeline">
    <div v-if="!timelinePanelStore.isAvailable" class="timeline-panel__empty">
      No timeline registered for this view.
    </div>
    <div v-else class="timeline-panel">
      <div class="timeline-panel__controls">
        <label class="timeline-panel__window-label" for="timeline-window">
          Window: {{ timelinePanelStore.windowSeconds }}s
        </label>
        <Slider
          id="timeline-window"
          :model-value="[timelinePanelStore.windowSeconds]"
          :min="1"
          :max="60"
          :step="1"
          @update:model-value="handleWindowChange"
        />
      </div>

      <div
        class="timeline-panel__track"
        :style="{ height: `calc(var(--spacing-6) * ${laneCount})` }"
      >
        <button
          v-for="bar in bars"
          :key="bar.id"
          type="button"
          class="timeline-panel__bar"
          :class="{ 'timeline-panel__bar--selected': bar.id === selectedActionId }"
          :style="{
            left: `${bar.left}%`,
            width: `${bar.width}%`,
            top: `calc(var(--spacing-6) * ${bar.lane})`
          }"
          :title="bar.name"
          @click="toggleSelection(bar.id)"
        >
          <span class="timeline-panel__bar-label">{{ bar.name }}</span>
        </button>
        <div class="timeline-panel__cursor" :style="{ left: `${cursorPercent}%` }" />
      </div>

      <div v-if="selectedAction" class="timeline-panel__details">
        <div class="timeline-panel__detail-row">
          <span class="timeline-panel__detail-label">Name</span>
          <span class="timeline-panel__detail-value">{{ selectedAction.name ?? '—' }}</span>
        </div>
        <div class="timeline-panel__detail-row">
          <span class="timeline-panel__detail-label">Category</span>
          <span class="timeline-panel__detail-value">{{ selectedAction.category ?? '—' }}</span>
        </div>
        <div class="timeline-panel__detail-row">
          <span class="timeline-panel__detail-label">ID</span>
          <span class="timeline-panel__detail-value">{{ selectedAction.id ?? '—' }}</span>
        </div>
        <div class="timeline-panel__detail-row">
          <span class="timeline-panel__detail-label">Start</span>
          <span class="timeline-panel__detail-value">{{
            formatFramesAsSeconds(selectedAction.start)
          }}</span>
        </div>
        <div class="timeline-panel__detail-row">
          <span class="timeline-panel__detail-label">End</span>
          <span class="timeline-panel__detail-value">{{
            formatFramesAsSeconds(selectedAction.end)
          }}</span>
        </div>
        <div class="timeline-panel__detail-row">
          <span class="timeline-panel__detail-label">Duration</span>
          <span class="timeline-panel__detail-value">{{
            formatFramesAsSeconds(selectedAction.duration)
          }}</span>
        </div>
        <div class="timeline-panel__detail-row">
          <span class="timeline-panel__detail-label">Enabled</span>
          <span class="timeline-panel__detail-value">{{ selectedAction.enabled !== false }}</span>
        </div>
        <div class="timeline-panel__detail-row">
          <span class="timeline-panel__detail-label">Priority</span>
          <span class="timeline-panel__detail-value">{{ selectedAction.priority ?? 0 }}</span>
        </div>
        <div v-if="selectedAction.metadata" class="timeline-panel__detail-row">
          <span class="timeline-panel__detail-label">Metadata</span>
          <span class="timeline-panel__detail-value">{{
            JSON.stringify(selectedAction.metadata)
          }}</span>
        </div>
      </div>
    </div>
  </GenericPanel>
</template>

<style scoped>
.timeline-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.timeline-panel__empty {
  padding: var(--spacing-2);
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
}

.timeline-panel__controls {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.timeline-panel__window-label {
  font-size: var(--font-size-xs);
  color: var(--color-foreground);
}

.timeline-panel__track {
  position: relative;
  min-height: var(--spacing-10);
  background: var(--color-secondary);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.timeline-panel__bar {
  position: absolute;
  height: var(--spacing-6);
  display: flex;
  align-items: center;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  opacity: 0.5;
  cursor: pointer;
  overflow: hidden;
  padding: 0 var(--spacing-1);
  transition: opacity 150ms;
}

.timeline-panel__bar:hover {
  opacity: 0.75;
}

.timeline-panel__bar--selected {
  opacity: 1;
}

.timeline-panel__bar-label {
  font-size: var(--font-size-2xs);
  color: var(--color-primary-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timeline-panel__cursor {
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
  background: var(--color-perf-bad);
  pointer-events: none;
}

.timeline-panel__details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  padding: var(--spacing-2);
  background: var(--color-secondary);
  border-radius: var(--radius-sm);
}

.timeline-panel__detail-row {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-2);
  font-size: var(--font-size-xs);
}

.timeline-panel__detail-label {
  color: var(--color-muted-foreground);
}

.timeline-panel__detail-value {
  color: var(--color-foreground);
  font-family: var(--font-mono);
  text-align: right;
  word-break: break-all;
}
</style>
