<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import ElementRow from './ElementRow.vue'
import SchemaControls from './ConfigControls.vue'
import IconButton from '@/components/IconButton.vue'
import IconPreview from '@/components/IconPreview.vue'
import { Box, Eye, EyeOff, Trash2 } from 'lucide-vue-next'
import type { SpawnGroup } from '@/stores/debugScene'
import { useDebugSceneStore } from '@/stores/debugScene'
import { useElementPropertiesStore } from '@/stores/elementProperties'

interface Properties {
  group: SpawnGroup
  isExpanded: boolean
}

defineProps<Properties>()
const emit = defineEmits<{ toggle: [] }>()

const debugSceneStore = useDebugSceneStore()
const elementPropertiesStore = useElementPropertiesStore()
const { activeProperties } = storeToRefs(elementPropertiesStore)

const hasExpandedSchema = computed(
  () => Object.keys(activeProperties.value?.schema ?? {}).length > 0
)
</script>

<template>
  <div class="element-spawn-group">
    <ElementRow :selected="isExpanded" :hidden="group.hidden" @click="emit('toggle')">
      <template #default="{ hovered }">
        <IconPreview :icon="Box" color="text-gray-400" size="sm" />
        <span class="element-spawn-group__label"> {{ group.label }} ({{ group.count }}) </span>
        <div
          class="element-spawn-group__actions"
          :class="{ 'element-spawn-group__actions--visible': hovered }"
        >
          <IconButton
            panel-colors
            :active="group.hidden"
            size="xs"
            :title="group.hidden ? 'Show group' : 'Hide group'"
            @click.stop="debugSceneStore.toggleSpawnGroupVisibility(group.id)"
          >
            <EyeOff v-if="group.hidden" />
            <Eye v-else />
          </IconButton>
          <IconButton
            panel-colors
            size="xs"
            title="Remove group"
            @click.stop="debugSceneStore.removeSpawnGroup(group.id)"
          >
            <Trash2 />
          </IconButton>
        </div>
      </template>
    </ElementRow>

    <div v-if="isExpanded" class="element-spawn-group__content">
      <SchemaControls
        v-if="hasExpandedSchema"
        :schema="activeProperties!.schema"
        :get-value="activeProperties!.getValue"
        :on-update="activeProperties!.updateValue"
      />
      <p v-else class="element-spawn-group__no-props">No configurable properties.</p>
    </div>
  </div>
</template>

<style scoped>
.element-spawn-group {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.element-spawn-group__label {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-xs);
  font-weight: 500;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.element-spawn-group__actions {
  display: flex;
  flex-shrink: 0;
  gap: var(--spacing-0-5);
  opacity: 0;
  transition: opacity 100ms;
}

.element-spawn-group__actions--visible {
  opacity: 1;
}

.element-spawn-group__content {
  border-top: 1px solid var(--color-border);
  padding: var(--spacing-2);
  background: var(--panel-content-bg);
}

.element-spawn-group__no-props {
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  opacity: var(--opacity-muted);
  margin: 0;
}
</style>
