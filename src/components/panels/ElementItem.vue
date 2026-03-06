<script setup lang="ts">
import IconPreview from '@/components/IconPreview.vue';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Trash2 } from 'lucide-vue-next';
import type { SceneElement } from '@/stores/debugScene';
import { getElementIcon, getElementColor } from './elementUtilities';

interface Props {
  element: SceneElement;
  selected?: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  click: [];
  'toggle-visibility': [];
  remove: [];
}>();
</script>

<template>
  <div
    class="element-item"
    :class="{ 'element-item--selected': selected }"
    @click="emit('click')"
  >
    <IconPreview :icon="getElementIcon(element)" :color="getElementColor(element)" />
    <div class="element-item__info">
      <span class="element-item__name">{{ element.name }}</span>
      <span class="element-item__type">{{ element.type }}</span>
    </div>
    <div class="element-item__actions">
      <Button
        :variant="element.hidden ? 'default' : 'ghost'"
        size="icon"
        class="element-item__action-btn"
        :title="element.hidden ? 'Show element' : 'Hide element'"
        @click.stop="emit('toggle-visibility')"
      >
        <EyeOff v-if="element.hidden" class="element-item__action-icon" />
        <Eye v-else class="element-item__action-icon" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="element-item__action-btn"
        title="Remove element"
        @click.stop="emit('remove')"
      >
        <Trash2 class="element-item__action-icon" />
      </Button>
    </div>
  </div>
</template>

<style scoped>
.element-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-1-5);
  padding: var(--spacing-1-5) var(--spacing-2);
  cursor: pointer;
  background: var(--panel-item-bg);
  transition: background-color 150ms;
}

.element-item:hover {
  background-color: var(--panel-item-bg-hover);
}

.element-item--selected {
  background-color: var(--panel-item-bg-selected);
}

.element-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0-5);
}

.element-item__name {
  font-size: var(--font-size-xs);
  font-weight: 500;
  font-family: monospace;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.element-item__type {
  font-size: var(--font-size-2xs);
  color: var(--color-muted-foreground);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.element-item__actions {
  display: flex;
  gap: var(--spacing-1);
  flex-shrink: 0;
}

.element-item__action-btn {
  width: var(--btn-sm-height);
  height: var(--btn-sm-height);
}

.element-item__action-icon {
  width: var(--font-size-base);
  height: var(--font-size-base);
}
</style>
