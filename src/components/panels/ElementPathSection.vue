<script setup lang="ts">
import { ref } from 'vue'
import SchemaControls from './ConfigControls.vue'
import IconButton from '@/components/IconButton.vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-vue-next'
import type { CoordinateTuple } from '@webgamekit/threejs'
import { logicClassifyPathSegment, type PathStepType } from '@webgamekit/logic'
import type { PathEntry, PathConfig } from '@/stores/debugScene'
import { useDebugSceneStore } from '@/stores/debugScene'

/** Tooltip copy for each step type shown beside a stepped path's waypoints. */
const STEP_DESCRIPTIONS: Record<PathStepType, string> = {
  walk: 'Walk — straight horizontal move. A descent walks off the edge and falls via gravity.',
  'forward-jump': 'Forward jump — a parabola up and over, landing on a higher ledge.',
  jump: 'Jump — hops straight up and back down in place (e.g. to bump a block above).'
}

/** Step type of the segment from waypoint `index` to the next (wrapping at the end). */
const stepTypeAt = (path: PathEntry, index: number): PathStepType =>
  logicClassifyPathSegment(
    path.waypoints[index],
    path.waypoints[(index + 1) % path.waypoints.length]
  )

interface Properties {
  path: PathEntry
}

const props = defineProps<Properties>()

const debugSceneStore = useDebugSceneStore()

const expanded = ref(true)

const handleUpdateWaypoint = (index: number, axis: 0 | 1 | 2, rawValue: string | number) => {
  const parsed = Number(rawValue)
  if (Number.isNaN(parsed)) return
  const current = props.path.waypoints[index]
  const next: CoordinateTuple = [current[0], current[1], current[2]]
  next[axis] = parsed
  debugSceneStore.updatePathWaypoint(props.path.id, index, next)
}

const handleDeleteWaypoint = (index: number) => {
  debugSceneStore.removePathWaypoint(props.path.id, index)
}

const handleAddWaypoint = () => {
  const last = props.path.waypoints.at(-1) ?? [0, 0, 0]
  debugSceneStore.addPathWaypoint(props.path.id, [last[0], last[1], last[2]])
}

// Playing pauses only this element's path, independent of the global timeline.
const handleConfigUpdate = (key: string, value: unknown) => {
  debugSceneStore.updatePathConfig(props.path.id, key as keyof PathConfig, value)
}

const pathSchema = {
  speed: { min: 1, max: 100, step: 1, label: 'Speed' },
  obstacleImpulse: { min: 0, max: 50, step: 1, label: 'Push Force' },
  easing: { bezier: true, label: 'Easing' },
  easingIntensity: { min: 0, max: 5, step: 0.01, label: 'Easing Intensity' },
  playing: { boolean: true, label: 'Playing' },
  loop: { boolean: true, label: 'Loop' },
  pingPong: { boolean: true, label: 'Ping Pong' },
  showPath: { boolean: true, label: 'Show Path' },
  showNodes: { boolean: true, label: 'Show Nodes' },
  reset: { callback: 'reset', label: 'Reset Path' }
}
</script>

<template>
  <div class="element-path-section">
    <div class="element-path-section__header">
      <button
        class="element-path-section__toggle"
        :title="expanded ? 'Collapse path' : 'Expand path'"
        @click="expanded = !expanded"
      >
        <ChevronDown v-if="expanded" class="element-path-section__chevron" />
        <ChevronRight v-else class="element-path-section__chevron" />
        <span>Path ({{ path.waypoints.length }})</span>
      </button>
      <IconButton
        panel-colors
        size="xs"
        title="Remove path"
        @click.stop="debugSceneStore.removePath(path.id)"
      >
        <Trash2 />
      </IconButton>
    </div>

    <div v-if="expanded" class="element-path-section__content">
      <div class="element-path-section__waypoints">
        <div
          v-for="(position, index) in path.waypoints"
          :key="index"
          class="element-path-section__row"
        >
          <span class="element-path-section__index">{{ index + 1 }}</span>
          <span
            v-if="path.stepped"
            class="element-path-section__step"
            :title="STEP_DESCRIPTIONS[stepTypeAt(path, index)]"
          >
            {{ stepTypeAt(path, index) }}
          </span>
          <template v-for="(axis, axisIndex) in ['x', 'y', 'z'] as const" :key="axis">
            <label class="element-path-section__axis-label">{{ axis }}</label>
            <Input
              class="element-path-section__input"
              type="number"
              :model-value="position[axisIndex as 0 | 1 | 2]"
              @update:model-value="handleUpdateWaypoint(index, axisIndex as 0 | 1 | 2, $event)"
            />
          </template>
          <IconButton
            panel-colors
            size="xs"
            title="Remove waypoint"
            @click="handleDeleteWaypoint(index)"
          >
            <Trash2 />
          </IconButton>
        </div>

        <Button
          variant="outline"
          size="sm"
          class="element-path-section__add"
          title="Add waypoint"
          @click="handleAddWaypoint"
        >
          <Plus class="element-path-section__add-icon" />
          Add waypoint
        </Button>
      </div>

      <SchemaControls
        :schema="pathSchema"
        :get-value="(key: string) => (path.config as Record<string, unknown>)[key]"
        :on-update="handleConfigUpdate"
        :on-action="
          (name: string) => {
            if (name === 'reset') path.handlers.onReset()
          }
        "
      />
    </div>
  </div>
</template>

<style scoped>
.element-path-section {
  display: flex;
  flex-direction: column;
  margin-top: var(--spacing-2);
  border-top: 1px solid var(--color-border);
  padding-top: var(--spacing-2);
}

.element-path-section__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.element-path-section__toggle {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-foreground);
}

.element-path-section__chevron {
  width: var(--font-size-sm);
  height: var(--font-size-sm);
  flex-shrink: 0;
}

.element-path-section__content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  margin-top: var(--spacing-1-5);
}

.element-path-section__waypoints {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0-5);
}

.element-path-section__step {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-primary);
  text-transform: capitalize;
  cursor: help;
}

.element-path-section__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-0-5);
}

.element-path-section__index {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  font-variant-numeric: tabular-nums;
  min-width: 1.4rem;
  text-align: right;
  flex-shrink: 0;
}

.element-path-section__axis-label {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  font-family: monospace;
  flex-shrink: 0;
}

.element-path-section__input {
  flex: 1;
  min-width: 0;
  height: var(--btn-xs-height);
  padding: 0 var(--spacing-1);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.element-path-section__add {
  width: 100%;
  gap: var(--spacing-1);
  margin-top: var(--spacing-0-5);
}

.element-path-section__add-icon {
  width: var(--font-size-xs);
  height: var(--font-size-xs);
}
</style>
