<script setup lang="ts">
import { computed } from 'vue';
import SchemaControls from './ConfigControls.vue';
import TexturePreview from '@/components/TexturePreview.vue';
import IconPreview from '@/components/IconPreview.vue';
import { Button } from '@/components/ui/button';
import { Box, Eye, EyeOff, Plus, Play, RefreshCw, Trash2 } from 'lucide-vue-next';
import { useTextureGroupsStore } from '@/stores/textureGroups';
import { useElementPropertiesStore } from '@/stores/elementProperties';
import { storeToRefs } from 'pinia';
import type { SceneElement } from '@/stores/debugScene';
import { getElementIcon, getElementColor } from './elementUtilities';

interface Props {
  groupId: string;
  label: string;
  isExpanded: boolean;
  isSelected: boolean;
  children?: SceneElement[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  toggle: [];
  'add-variant': [];
}>();

const textureStore = useTextureGroupsStore();
const elementPropertiesStore = useElementPropertiesStore();
const { activeProperties } = storeToRefs(elementPropertiesStore);

const hasExpandedSchema = computed(
  () => Object.keys(activeProperties.value?.schema ?? {}).length > 0
);

const triggerFileUpload = (onchange: (event: Event) => void) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = onchange;
  input.click();
};

const handleAddVariant = () => {
  triggerFileUpload((e) => textureStore.handlers?.onAddTextureToGroup(props.groupId, e));
};
</script>

<template>
  <div class="element-group">
    <button
      class="element-group__header"
      :class="{
        'element-group__header--active': isSelected || isExpanded,
        'opacity-50': textureStore.groups.find(g => g.id === groupId)?.hidden,
      }"
      @click="emit('toggle')"
    >
      <IconPreview :icon="Box" color="text-gray-400" />
      <span class="element-group__label">{{ label }}</span>
      <template v-if="textureStore.groups.find(g => g.id === groupId)">
        <Button
          :variant="textureStore.groups.find(g => g.id === groupId)?.hidden ? 'default' : 'ghost'"
          size="icon"
          class="h-7 w-7 shrink-0"
          :title="textureStore.groups.find(g => g.id === groupId)?.hidden ? 'Show group' : 'Hide group'"
          @click.stop="textureStore.handlers?.onToggleVisibility(groupId)"
        >
          <EyeOff v-if="textureStore.groups.find(g => g.id === groupId)?.hidden" class="h-3.5 w-3.5" />
          <Eye v-else class="h-3.5 w-3.5" />
        </Button>
        <Button
          :variant="textureStore.groups.find(g => g.id === groupId)?.showWireframe ? 'default' : 'ghost'"
          size="icon"
          class="h-7 w-7 shrink-0"
          :title="textureStore.groups.find(g => g.id === groupId)?.showWireframe ? 'Hide wireframe' : 'Show wireframe'"
          @click.stop="textureStore.handlers?.onToggleWireframe(groupId)"
        >
          <Box class="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 shrink-0"
          title="Delete group"
          @click.stop="textureStore.handlers?.onRemoveGroup(groupId)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </Button>
      </template>
    </button>

    <div v-if="isExpanded" class="element-group__content">
      <template v-if="textureStore.groups.find(g => g.id === groupId)">
        <div class="element-group__variants">
          <TexturePreview
            v-for="texture in textureStore.groups.find(g => g.id === groupId)!.textures"
            :key="texture.id"
            :src="texture.url"
            :alt="texture.name"
            class="element-group__variant-preview"
          >
            <button
              class="element-group__variant-remove"
              title="Remove texture"
              @click.stop="textureStore.handlers?.onRemoveTexture(groupId, texture.id)"
            >
              <Trash2 class="h-2.5 w-2.5" />
            </button>
          </TexturePreview>
          <button
            class="element-group__variant-add"
            title="Add variant"
            @click.stop="handleAddVariant"
          >
            <Plus class="h-4 w-4" />
          </button>
        </div>

        <div class="element-group__update-bar">
          <Button
            variant="ghost"
            size="icon"
            :class="{ 'element-group__toggle--active': textureStore.autoUpdate }"
            title="Auto Update"
            @click="textureStore.autoUpdate = !textureStore.autoUpdate"
          >
            <RefreshCw class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Update Now"
            @click="textureStore.handlers?.onManualUpdate()"
          >
            <Play class="h-4 w-4" />
          </Button>
        </div>

        <SchemaControls
          v-if="hasExpandedSchema"
          :schema="activeProperties!.schema"
          :get-value="activeProperties!.getValue"
          :on-update="activeProperties!.updateValue"
        />
      </template>

      <template v-else>
        <div class="element-group__children">
          <div
            v-for="(child, index) in children"
            :key="index"
            class="element-group__child"
            :class="{ 'opacity-50': child.hidden }"
          >
            <IconPreview :icon="getElementIcon(child)" :color="getElementColor(child)" />
            <div class="flex-1 min-w-0 flex flex-col gap-0.5">
              <span class="text-[11px] font-medium font-mono truncate block">{{ child.name }}</span>
              <span class="text-[9px] text-muted-foreground truncate block">{{ child.type }}</span>
            </div>
          </div>
        </div>
        <SchemaControls
          v-if="hasExpandedSchema"
          :schema="activeProperties!.schema"
          :get-value="activeProperties!.getValue"
          :on-update="activeProperties!.updateValue"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.element-group {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.element-group__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-1-5);
  padding: var(--spacing-1-5) var(--spacing-2);
  background: transparent;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: background-color 150ms;
}

.element-group__header:hover {
  background-color: var(--panel-item-bg-hover);
}

.element-group__header--active {
  background-color: var(--panel-item-bg-selected);
}

.element-group__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.element-group__content {
  border-top: 1px solid var(--color-border);
  padding: var(--spacing-2);
  background: var(--panel-content-bg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.element-group__children {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.element-group__child {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-1-5);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-muted) 30%, transparent);
}

.element-group__variants {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.element-group__variant-preview {
  width: var(--thumbnail-size);
  height: var(--thumbnail-size);
  min-width: var(--thumbnail-size);
  min-height: var(--thumbnail-size);
  max-width: var(--thumbnail-size);
  max-height: var(--thumbnail-size);
}

.element-group__variant-remove {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--panel-overlay-bg);
  color: var(--panel-remove-color);
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
  z-index: var(--z-dropdown);
  transition: opacity 0.15s;
}

.element-group__variant-preview:hover .element-group__variant-remove {
  opacity: 1;
}

.element-group__variant-add {
  width: var(--thumbnail-size);
  height: var(--thumbnail-size);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-muted);
  color: var(--color-muted-foreground);
  cursor: pointer;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  padding: 0;
  flex-shrink: 0;
  transition: background 0.15s;
}

.element-group__variant-add:hover {
  background: var(--color-accent);
}

.element-group__update-bar {
  display: flex;
  gap: var(--spacing-1);
  align-items: center;
}

.element-group__toggle--active {
  background-color: var(--panel-toggle-active-bg);
  color: var(--color-accent-foreground);
}
</style>
