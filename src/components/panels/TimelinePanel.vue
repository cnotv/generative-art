<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import GenericPanel from './GenericPanel.vue'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { usePanelsStore } from '@/stores/panels'
import { useTimelinePanelStore } from '@/stores/timelinePanel'
import { getTimelineChartBars, type Timeline } from '@webgamekit/animation'

interface TimelineBar {
  id: string
  name: string
  left: number
  width: number
  lane: number
  colorIndex: number
  enabled: boolean
  action: Timeline
}

interface TimelineLane {
  lane: number
  name: string
  enabled: boolean
  action: Timeline
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

/**
 * Enabled overrides keyed by action id, applied on top of `action.enabled` so
 * a checkbox toggle is reflected immediately without waiting for the next
 * timeline recompute (e.g. while the animation is paused).
 */
const enabledOverrides = ref<Map<string, boolean>>(new Map())

const isActionEnabled = (action: Timeline): boolean => {
  const override = action.id ? enabledOverrides.value.get(action.id) : undefined
  return override ?? action.enabled !== false
}

const bars = computed<TimelineBar[]>(() => {
  const source = timelinePanelStore.source
  if (!source) return []

  const rangeStart = windowStart.value
  const rangeEnd = rangeStart + timelinePanelStore.windowSeconds

  return getTimelineChartBars(source.getTimeline(), {
    rangeStart,
    rangeEnd,
    rate: frameRate.value
  }).map((bar) => ({ ...bar, enabled: isActionEnabled(bar.action) }))
})

const laneCount = computed(() => Math.max(1, lanes.value.length))

/** One row per registered action, used to render the row gutter (name + enabled checkbox). */
const lanes = computed<TimelineLane[]>(() => {
  const source = timelinePanelStore.source
  if (!source) return []
  return source.getTimeline().map((action, lane) => ({
    lane,
    name: action.name ?? action.category ?? `Action ${lane + 1}`,
    enabled: isActionEnabled(action),
    action
  }))
})

const selectedAction = computed(
  () => bars.value.find((bar) => bar.id === selectedActionId.value)?.action ?? null
)

const toggleSelection = (id: string) => {
  selectedActionId.value = selectedActionId.value === id ? null : id
}

const handleWindowChange = (value: number[]) => {
  timelinePanelStore.setWindowSeconds(value[0])
}

const handleToggleEnabled = (id: string | undefined, enabled: boolean) => {
  if (!id) return
  enabledOverrides.value = new Map(enabledOverrides.value).set(id, enabled)
  timelinePanelStore.source?.setActionEnabled(id, enabled)
}

const formatFramesAsSeconds = (frames: number | undefined): string =>
  frames === undefined ? '—' : `${(frames * frameRate.value).toFixed(2)}s`
</script>

<template>
  <GenericPanel panel-type="timeline" side="right" title="Timeline" wide>
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
        <label class="timeline-panel__pause-label">
          <Checkbox
            :model-value="timelinePanelStore.isPaused"
            @update:model-value="timelinePanelStore.setPaused"
          />
          <span>Pause animation</span>
        </label>
      </div>

      <div class="timeline-panel__timeline">
        <div
          class="timeline-panel__gutter"
          :style="{ height: `calc(var(--spacing-6) * ${laneCount})` }"
        >
          <label
            v-for="row in lanes"
            :key="row.lane"
            class="timeline-panel__row-toggle"
            :style="{ top: `calc(var(--spacing-6) * ${row.lane})` }"
            :title="row.name"
          >
            <Checkbox
              :model-value="row.enabled"
              @update:model-value="(value: boolean) => handleToggleEnabled(row.action.id, value)"
            />
            <span class="timeline-panel__row-label">{{ row.name }}</span>
          </label>
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
            :class="{
              'timeline-panel__bar--selected': bar.id === selectedActionId,
              'timeline-panel__bar--disabled': !bar.enabled
            }"
            :style="{
              left: `${bar.left}%`,
              width: `${bar.width}%`,
              top: `calc(var(--spacing-6) * ${bar.lane})`,
              background: `var(--timeline-color-${bar.colorIndex})`
            }"
            :title="bar.name"
            @click="toggleSelection(bar.id)"
          >
            <span class="timeline-panel__bar-label">{{ bar.name }}</span>
          </button>
          <div class="timeline-panel__cursor" :style="{ left: `${cursorPercent}%` }" />
        </div>
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
          <label class="timeline-panel__enabled-toggle">
            <Checkbox
              :model-value="isActionEnabled(selectedAction)"
              @update:model-value="
                (value: boolean) => handleToggleEnabled(selectedAction?.id, value)
              "
            />
          </label>
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

.timeline-panel__pause-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: var(--color-foreground);
  cursor: pointer;
}

.timeline-panel__timeline {
  display: flex;
  gap: var(--spacing-1);
}

.timeline-panel__gutter {
  position: relative;
  flex: 0 0 var(--timeline-gutter-width);
}

.timeline-panel__row-toggle {
  position: absolute;
  left: 0;
  right: 0;
  height: var(--spacing-6);
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  font-size: var(--font-size-2xs);
  color: var(--color-foreground);
  cursor: pointer;
  overflow: hidden;
}

.timeline-panel__row-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timeline-panel__track {
  position: relative;
  flex: 1;
  min-height: var(--spacing-10);
  background: var(--color-secondary);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.timeline-panel__bar {
  position: absolute;
  padding: 0;
  height: var(--spacing-6);
  display: flex;
  align-items: center;
  border: none;
  border-radius: var(--radius-sm);
  opacity: 0.5;
  cursor: pointer;
  overflow: hidden;
  transition: opacity 150ms;
}

.timeline-panel__bar:hover {
  opacity: 0.75;
}

.timeline-panel__bar--selected {
  opacity: 1;
}

.timeline-panel__bar--disabled {
  opacity: var(--opacity-disabled);
}

.timeline-panel__enabled-toggle {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.timeline-panel__bar-label {
  padding: 0 var(--spacing-1);
  font-size: var(--font-size-2xs);
  color: var(--timeline-bar-foreground);
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
