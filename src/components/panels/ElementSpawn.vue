<script setup lang="ts">
import { computed } from 'vue';
import SchemaControls from './ConfigControls.vue';
import IconPreview from '@/components/IconPreview.vue';
import IconButton from '@/components/IconButton.vue';
import { Cpu, Eye, EyeOff, Trash2 } from 'lucide-vue-next';
import { useDebugSceneStore } from '@/stores/debugScene';
import { useElementPropertiesStore } from '@/stores/elementProperties';
import { storeToRefs } from 'pinia';

interface Properties {
  spawnId: string;
  label: string;
  isExpanded: boolean;
  isSelected: boolean;
  hidden: boolean;
}

const props = defineProps<Properties>();

const emit = defineEmits<{
  toggle: [];
}>();

const debugSceneStore = useDebugSceneStore();
const elementPropertiesStore = useElementPropertiesStore();
const { activeProperties } = storeToRefs(elementPropertiesStore);

const hasExpandedSchema = computed(
  () => Object.keys(activeProperties.value?.schema ?? {}).length > 0
);
</script>

<template>
  <div class="element-spawn">
    <div
      class="element-spawn__header"
      :class="{ 'element-spawn__header--active': isSelected || isExpanded, 'element-spawn__header--hidden': hidden }"
      role="button"
      tabindex="0"
      @click="emit('toggle'); if (!isExpanded) elementPropertiesStore.openElementProperties(spawnId)"
      @keydown.enter.space.prevent="emit('toggle'); if (!isExpanded) elementPropertiesStore.openElementProperties(spawnId)"
    >
      <IconPreview :icon="Cpu" color="text-purple-400" />
      <div class="element-spawn__info">
        <span class="element-spawn__label">{{ label }}</span>
        <span class="element-spawn__type">Spawn</span>
      </div>
      <div class="element-spawn__actions">
        <IconButton
          size="sm"
          :title="hidden ? 'Show' : 'Hide'"
          @click.stop="debugSceneStore.toggleSpawnVisibility(spawnId)"
        >
          <EyeOff v-if="hidden" />
          <Eye v-else />
        </IconButton>
        <IconButton
          size="sm"
          title="Remove spawn"
          @click.stop="debugSceneStore.unregisterSpawn(spawnId)"
        >
          <Trash2 />
        </IconButton>
      </div>
    </div>

    <div v-if="isExpanded" class="element-spawn__content">
      <SchemaControls
        v-if="hasExpandedSchema"
        :schema="activeProperties!.schema"
        :get-value="activeProperties!.getValue"
        :on-update="activeProperties!.updateValue"
      />
      <p v-else class="element-spawn__no-props">No configurable properties.</p>
    </div>
  </div>
</template>

<style scoped>
.element-spawn {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.element-spawn__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-1-5);
  padding: var(--spacing-1-5) var(--spacing-2);
  background: var(--panel-item-bg);
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: background-color 150ms;
  overflow: hidden;
}

.element-spawn__header:hover {
  background-color: var(--panel-item-bg-hover);
}

.element-spawn__header--active {
  background-color: var(--panel-item-bg-selected);
}

.element-spawn__header--hidden {
  opacity: 0.5;
}

.element-spawn__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0-5);
}

.element-spawn__label {
  font-size: var(--font-size-xs);
  font-weight: 500;
  font-family: monospace;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.element-spawn__type {
  font-size: var(--font-size-2xs);
  color: var(--color-muted-foreground);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.element-spawn__content {
  border-top: 1px solid var(--color-border);
  padding: var(--spacing-2);
  background: var(--panel-content-bg);
}

.element-spawn__actions {
  display: flex;
  flex-shrink: 0;
  gap: var(--spacing-0-5);
}

.element-spawn__no-props {
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  opacity: var(--opacity-muted);
  margin: 0;
}
</style>
