<script setup lang="ts">
import { computed } from 'vue';
import SchemaControls from './ConfigControls.vue';
import TexturePreview from '@/components/TexturePreview.vue';
import IconPreview from '@/components/IconPreview.vue';
import IconButton from '@/components/IconButton.vue';
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

const group = computed(() => textureStore.groups.find(g => g.id === props.groupId));
</script>

<template>
  <div class="element-group">
    <button
      class="element-group__header"
      :class="{
        'element-group__header--active': isSelected || isExpanded,
        'element-group__header--hidden': group?.hidden,
      }"
      @click="emit('toggle')"
    >
      <IconPreview :icon="Box" color="text-gray-400" />
      <span class="element-group__label">{{ label }}</span>
      <template v-if="group">
        <IconButton
          :active="group.hidden"
          size="sm"
          :title="group.hidden ? 'Show group' : 'Hide group'"
          @click="textureStore.handlers?.onToggleVisibility(groupId)"
        >
          <EyeOff v-if="group.hidden" />
          <Eye v-else />
        </IconButton>
        <IconButton
          :active="group.showWireframe"
          size="sm"
          :title="group.showWireframe ? 'Hide wireframe' : 'Show wireframe'"
          @click="textureStore.handlers?.onToggleWireframe(groupId)"
        >
          <Box />
        </IconButton>
        <IconButton
          size="sm"
          title="Delete group"
          @click="textureStore.handlers?.onRemoveGroup(groupId)"
        >
          <Trash2 />
        </IconButton>
      </template>
    </button>

    <div v-if="isExpanded" class="element-group__content">
      <template v-if="group">
        <div class="element-group__variants">
          <TexturePreview
            v-for="texture in group.textures"
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
              <Trash2 class="element-group__variant-remove-icon" />
            </button>
          </TexturePreview>
          <button
            class="element-group__variant-add"
            title="Add variant"
            @click.stop="handleAddVariant"
          >
            <Plus class="element-group__variant-add-icon" />
          </button>
        </div>

        <div class="element-group__update-bar">
          <IconButton
            :active="textureStore.autoUpdate"
            title="Auto Update"
            @click="textureStore.autoUpdate = !textureStore.autoUpdate"
          >
            <RefreshCw />
          </IconButton>
          <IconButton title="Update Now" @click="textureStore.handlers?.onManualUpdate()">
            <Play />
          </IconButton>
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
            :class="{ 'element-group__child--hidden': child.hidden }"
          >
            <IconPreview :icon="getElementIcon(child)" :color="getElementColor(child)" />
            <div class="element-group__child-info">
              <span class="element-group__child-name">{{ child.name }}</span>
              <span class="element-group__child-type">{{ child.type }}</span>
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

.element-group__header--hidden {
  opacity: var(--opacity-muted);
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

.element-group__child--hidden {
  opacity: var(--opacity-muted);
}

.element-group__child-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0-5);
}

.element-group__child-name {
  font-size: var(--font-size-xs);
  font-weight: 500;
  font-family: monospace;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.element-group__child-type {
  font-size: var(--font-size-2xs);
  color: var(--color-muted-foreground);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.element-group__variants {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1-5);
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

.element-group__variant-remove-icon {
  width: var(--font-size-sm);
  height: var(--font-size-sm);
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

.element-group__variant-add-icon {
  width: var(--font-size-md);
  height: var(--font-size-md);
}

.element-group__update-bar {
  display: flex;
  gap: var(--spacing-1);
  align-items: center;
}
</style>
