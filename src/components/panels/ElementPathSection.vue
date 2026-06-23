<script setup lang="ts">
import { ref } from 'vue'
import SchemaControls from './ConfigControls.vue'
import IconButton from '@/components/IconButton.vue'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-vue-next'
import type { CoordinateTuple } from '@webgamekit/threejs'
import type { PathEntry, PathConfig } from '@/stores/debugScene'
import { useDebugSceneStore } from '@/stores/debugScene'

interface Properties {
  path: PathEntry
}

const props = defineProps<Properties>()

const debugSceneStore = useDebugSceneStore()

const expanded = ref(true)

const parseCoord = (value: string, fallback: number): number => {
  const parsed = parseFloat(value)
  return isNaN(parsed) ? fallback : parsed
}

const handleUpdateWaypoint = (index: number, axis: 0 | 1 | 2, rawValue: string) => {
  const current = props.path.waypoints[index]
  const next: CoordinateTuple = [current[0], current[1], current[2]]
  next[axis] = parseCoord(rawValue, current[axis])
  debugSceneStore.updatePathWaypoint(props.path.id, index, next)
}

const handleDeleteWaypoint = (index: number) => {
  debugSceneStore.removePathWaypoint(props.path.id, index)
}

const handleAddWaypoint = () => {
  const last = props.path.waypoints.at(-1) ?? [0, 0, 0]
  const next: CoordinateTuple = [last[0], last[1], last[2]]
  debugSceneStore.addPathWaypoint(props.path.id, next)
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

const editingCell = ref<string | null>(null)
const editingValue = ref('')

const startEdit = (key: string, value: number) => {
  editingCell.value = key
  editingValue.value = String(value)
}

const commitEdit = (index: number, axis: 0 | 1 | 2) => {
  handleUpdateWaypoint(index, axis, editingValue.value)
  editingCell.value = null
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
          <template v-for="(axis, axisIndex) in ['x', 'y', 'z'] as const" :key="axis">
            <label class="element-path-section__axis-label">{{ axis }}</label>
            <input
              v-if="editingCell === `${index}-${axisIndex}`"
              class="element-path-section__input element-path-section__input--editing"
              type="number"
              :value="editingValue"
              autofocus
              @input="editingValue = ($event.target as HTMLInputElement).value"
              @blur="commitEdit(index, axisIndex as 0 | 1 | 2)"
              @keydown.enter="commitEdit(index, axisIndex as 0 | 1 | 2)"
              @keydown.escape="editingCell = null"
            />
            <button
              v-else
              class="element-path-section__input"
              :title="`Edit ${axis}`"
              @click="startEdit(`${index}-${axisIndex}`, position[axisIndex as 0 | 1 | 2])"
            >
              {{ position[axisIndex as 0 | 1 | 2] }}
            </button>
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

        <button class="element-path-section__add" title="Add waypoint" @click="handleAddWaypoint">
          <Plus class="element-path-section__add-icon" />
          <span>Add waypoint</span>
        </button>
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
  font-family: monospace;
  font-variant-numeric: tabular-nums;
  background: var(--panel-item-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-foreground);
  cursor: pointer;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background-color 100ms;
}

.element-path-section__input:hover {
  background-color: var(--panel-item-bg-hover);
}

.element-path-section__input--editing {
  cursor: text;
  outline: 1px solid var(--color-primary);
}

.element-path-section__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1);
  margin-top: var(--spacing-0-5);
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  background: transparent;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  width: 100%;
  transition: background-color 100ms;
}

.element-path-section__add:hover {
  background-color: var(--panel-item-bg-hover);
  color: var(--color-foreground);
}

.element-path-section__add-icon {
  width: var(--font-size-xs);
  height: var(--font-size-xs);
}
</style>
