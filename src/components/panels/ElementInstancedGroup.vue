<script setup lang="ts">
import { ref } from 'vue'
import ElementRow from './ElementRow.vue'
import IconButton from '@/components/IconButton.vue'
import IconPreview from '@/components/IconPreview.vue'
import { Eye, EyeOff, Layers, Plus, Trash2 } from 'lucide-vue-next'
import type { CoordinateTuple } from '@webgamekit/threejs'
import type { InstancedGroup } from '@/stores/debugScene'
import { useDebugSceneStore } from '@/stores/debugScene'

interface Properties {
  group: InstancedGroup
  isExpanded: boolean
}

const props = defineProps<Properties>()
const emit = defineEmits<{ toggle: [] }>()

const debugSceneStore = useDebugSceneStore()

const parseCoord = (value: string, fallback: number): number => {
  const parsed = parseFloat(value)
  return isNaN(parsed) ? fallback : parsed
}

const handleUpdate = (index: number, axis: 0 | 1 | 2, rawValue: string) => {
  const current = props.group.positions[index]
  const next: CoordinateTuple = [current[0], current[1], current[2]]
  next[axis] = parseCoord(rawValue, current[axis])
  debugSceneStore.updateInstancedGroupPosition(props.group.id, index, next)
  props.group.handlers.onUpdate(index, next)
}

const handleDelete = (index: number) => {
  props.group.handlers.onDelete(index)
}

const handleAdd = () => {
  const last = props.group.positions.at(-1) ?? [0, 0, 0]
  const next: CoordinateTuple = [last[0], last[1], last[2]]
  props.group.handlers.onAdd(next)
}

const editingCell = ref<string | null>(null)
const editingValue = ref('')

const startEdit = (key: string, value: number) => {
  editingCell.value = key
  editingValue.value = String(value)
}

const commitEdit = (index: number, axis: 0 | 1 | 2) => {
  handleUpdate(index, axis, editingValue.value)
  editingCell.value = null
}
</script>

<template>
  <div class="element-instanced-group">
    <ElementRow :selected="isExpanded" :hidden="group.hidden" @click="emit('toggle')">
      <template #default="{ hovered }">
        <IconPreview :icon="Layers" color="text-blue-400" size="sm" />
        <span class="element-instanced-group__label">
          {{ group.label }} ({{ group.positions.length }})
        </span>
        <div
          class="element-instanced-group__actions"
          :class="{ 'element-instanced-group__actions--visible': hovered }"
        >
          <IconButton
            panel-colors
            :active="group.hidden"
            size="xs"
            :title="group.hidden ? 'Show group' : 'Hide group'"
            @click.stop="debugSceneStore.toggleInstancedGroupVisibility(group.id)"
          >
            <EyeOff v-if="group.hidden" />
            <Eye v-else />
          </IconButton>
          <IconButton
            panel-colors
            size="xs"
            title="Remove group"
            @click.stop="debugSceneStore.removeInstancedGroup(group.id)"
          >
            <Trash2 />
          </IconButton>
        </div>
      </template>
    </ElementRow>

    <div v-if="isExpanded" class="element-instanced-group__content">
      <div
        v-for="(position, index) in group.positions"
        :key="index"
        class="element-instanced-group__row"
      >
        <span class="element-instanced-group__index">{{ index + 1 }}</span>
        <template v-for="(axis, axisIndex) in ['x', 'y', 'z'] as const" :key="axis">
          <label class="element-instanced-group__axis-label">{{ axis }}</label>
          <input
            v-if="editingCell === `${index}-${axisIndex}`"
            class="element-instanced-group__input element-instanced-group__input--editing"
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
            class="element-instanced-group__input"
            :title="`Edit ${axis}`"
            @click="startEdit(`${index}-${axisIndex}`, position[axisIndex as 0 | 1 | 2])"
          >
            {{ position[axisIndex as 0 | 1 | 2] }}
          </button>
        </template>
        <IconButton panel-colors size="xs" title="Remove position" @click="handleDelete(index)">
          <Trash2 />
        </IconButton>
      </div>

      <button class="element-instanced-group__add" title="Add position" @click="handleAdd">
        <Plus class="element-instanced-group__add-icon" />
        <span>Add</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.element-instanced-group {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.element-instanced-group__label {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-xs);
  font-weight: 500;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.element-instanced-group__actions {
  display: flex;
  flex-shrink: 0;
  gap: var(--spacing-0-5);
  opacity: 0;
  transition: opacity 100ms;
}

.element-instanced-group__actions--visible {
  opacity: 1;
}

.element-instanced-group__content {
  border-top: 1px solid var(--color-border);
  padding: var(--spacing-1);
  background: var(--panel-content-bg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0-5);
}

.element-instanced-group__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-0-5);
}

.element-instanced-group__index {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  font-variant-numeric: tabular-nums;
  min-width: 1.4rem;
  text-align: right;
  flex-shrink: 0;
}

.element-instanced-group__axis-label {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  font-family: monospace;
  flex-shrink: 0;
}

.element-instanced-group__input {
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

.element-instanced-group__input:hover {
  background-color: var(--panel-item-bg-hover);
}

.element-instanced-group__input--editing {
  cursor: text;
  outline: 1px solid var(--color-primary);
}

.element-instanced-group__add {
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

.element-instanced-group__add:hover {
  background-color: var(--panel-item-bg-hover);
  color: var(--color-foreground);
}

.element-instanced-group__add-icon {
  width: var(--font-size-xs);
  height: var(--font-size-xs);
}
</style>
