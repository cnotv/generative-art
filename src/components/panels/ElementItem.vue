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
    <div class="flex-1 min-w-0 flex flex-col gap-0.5">
      <span class="text-[11px] font-medium font-mono truncate block">{{ element.name }}</span>
      <span class="text-[9px] text-muted-foreground truncate block">{{ element.type }}</span>
    </div>
    <div class="flex gap-1 shrink-0">
      <Button
        :variant="element.hidden ? 'default' : 'ghost'"
        size="icon"
        class="h-7 w-7"
        :title="element.hidden ? 'Show element' : 'Hide element'"
        @click.stop="emit('toggle-visibility')"
      >
        <EyeOff v-if="element.hidden" class="h-3.5 w-3.5" />
        <Eye v-else class="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        title="Remove element"
        @click.stop="emit('remove')"
      >
        <Trash2 class="h-3.5 w-3.5" />
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
</style>
