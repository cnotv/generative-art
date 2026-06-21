<script setup lang="ts">
import ElementRow from './ElementRow.vue'
import IconPreview from '@/components/IconPreview.vue'
import IconButton from '@/components/IconButton.vue'
import { Eye, EyeOff, Route, Trash2 } from 'lucide-vue-next'
import type { SceneElement } from '@/stores/debugScene'
import { getElementIcon, getElementColor, getElementCategory } from './elementUtilities'

interface Properties {
  element: SceneElement
  selected?: boolean
  hasPath?: boolean
  canEnablePath?: boolean
}

const props = defineProps<Properties>()

const emit = defineEmits<{
  click: []
  'toggle-visibility': []
  remove: []
  'enable-path': []
}>()

const isMesh = (element: SceneElement) =>
  getElementCategory(element) === 'mesh' && !element.name.toLowerCase().includes('camera')
</script>

<template>
  <ElementRow :selected="selected" :hidden="element.hidden" @click="emit('click')">
    <template #default="{ hovered }">
      <IconPreview :icon="getElementIcon(element)" :color="getElementColor(element)" size="sm" />
      <span class="element-item__name">{{ element.label ?? element.name }}</span>
      <div class="element-item__actions" :class="{ 'element-item__actions--visible': hovered }">
        <IconButton
          v-if="canEnablePath && isMesh(element) && !hasPath"
          panel-colors
          size="xs"
          title="Enable path for this element"
          @click.stop="emit('enable-path')"
        >
          <Route />
        </IconButton>
        <IconButton
          panel-colors
          :active="element.hidden"
          size="xs"
          :title="element.hidden ? 'Show element' : 'Hide element'"
          @click.stop="emit('toggle-visibility')"
        >
          <EyeOff v-if="element.hidden" />
          <Eye v-else />
        </IconButton>
        <IconButton panel-colors size="xs" title="Remove element" @click.stop="emit('remove')">
          <Trash2 />
        </IconButton>
      </div>
    </template>
  </ElementRow>
</template>

<style scoped>
.element-item__name {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-xs);
  font-weight: 500;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.element-item__actions {
  display: flex;
  gap: var(--spacing-0-5);
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 100ms;
}

.element-item__actions--visible {
  opacity: 1;
}
</style>
