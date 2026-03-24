<script setup lang="ts">
import { ref } from "vue";
import { Eye, EyeOff, Trash2, Box, Play, RefreshCw, Plus } from "lucide-vue-next";
import GenericPanel from "./GenericPanel.vue";
import { Button } from "@/components/ui/button";
import IconButton from "@/components/IconButton.vue";
import TexturePreview from "@/components/TexturePreview.vue";

interface TextureItem {
  id: string;
  name: string;
  filename: string;
  url: string;
}

interface TextureGroup {
  id: string;
  name: string;
  textures: TextureItem[];
  hidden?: boolean;
  showWireframe?: boolean;
}

interface Properties {
  textureGroups: TextureGroup[];
  selectedGroupId: string | null;
  autoUpdate?: boolean;
}

interface Emits {
  (e: "selectGroup", id: string): void;
  (e: "removeGroup", id: string): void;
  (e: "removeTexture", groupId: string, textureId: string): void;
  (e: "toggleVisibility", id: string): void;
  (e: "toggleWireframe", id: string): void;
  (e: "fileChange", event: Event): void;
  (e: "addTexture", groupId: string, event: Event): void;
  (e: "update:autoUpdate", value: boolean): void;
  (e: "manualUpdate"): void;
}

const props = withDefaults(defineProps<Properties>(), {
  autoUpdate: true,
});
const emit = defineEmits<Emits>();

const fileInputReference = ref<HTMLInputElement | null>(null);
const addToGroupInputReferences = ref<Record<string, HTMLInputElement | null>>({});

const handleAddClick = () => {
  fileInputReference.value?.click();
};

const handleFileChange = (event: Event) => {
  emit("fileChange", event);
};

const handleAddTextureToGroup = (groupId: string) => {
  const input = addToGroupInputReferences.value[groupId];
  input?.click();
};

const handleGroupFileChange = (groupId: string, event: Event) => {
  emit("addTexture", groupId, event);
};

const setAddToGroupReference = (groupId: string, element: unknown) => {
  addToGroupInputReferences.value[groupId] = element as HTMLInputElement | null;
};
</script>

<template>
  <GenericPanel panel-type="elements" side="left" title="Textures">
    <div class="textures-panel__toolbar">
      <Button variant="default" class="textures-panel__add-btn" @click="handleAddClick">
        Add Texture
      </Button>
      <IconButton
        :active="props.autoUpdate"
        title="Auto Update"
        @click="emit('update:autoUpdate', !props.autoUpdate)"
      >
        <RefreshCw />
      </IconButton>
      <IconButton title="Update Now" size="lg" @click="emit('manualUpdate')">
        <Play />
      </IconButton>
    </div>

    <input
      ref="fileInputReference"
      type="file"
      accept="image/*"
      style="display: none"
      @change="handleFileChange"
    />

    <div v-if="textureGroups.length > 0" class="textures-panel__list">
      <div
        v-for="group in textureGroups"
        :key="group.id"
        class="textures-panel__group"
        :class="{
          'textures-panel__group--selected': selectedGroupId === group.id,
          'textures-panel__group--hidden': group.hidden,
        }"
      >
        <div
          class="textures-panel__group-header"
          @click="emit('selectGroup', group.id)"
        >
          <div class="textures-panel__group-info">
            <span class="textures-panel__group-name">{{ group.name }}</span>
          </div>
          <div class="textures-panel__group-actions">
            <IconButton
              :active="group.hidden"
              size="md"
              :title="group.hidden ? 'Show group' : 'Hide group'"
              @click.stop="emit('toggleVisibility', group.id)"
            >
              <EyeOff v-if="group.hidden" />
              <Eye v-else />
            </IconButton>
            <IconButton
              :active="group.showWireframe"
              size="md"
              :title="group.showWireframe ? 'Hide wireframe' : 'Show wireframe'"
              @click.stop="emit('toggleWireframe', group.id)"
            >
              <Box />
            </IconButton>
            <IconButton
              size="md"
              title="Delete group"
              @click.stop="emit('removeGroup', group.id)"
            >
              <Trash2 />
            </IconButton>
          </div>
        </div>

        <div class="textures-panel__variants">
          <TexturePreview
            v-for="texture in group.textures"
            :key="texture.id"
            :src="texture.url"
            :alt="texture.name"
            class="textures-panel__variant-preview"
          >
            <button
              class="textures-panel__variant-remove"
              title="Remove texture"
              @click.stop="emit('removeTexture', group.id, texture.id)"
            >
              <Trash2 class="textures-panel__variant-remove-icon" />
            </button>
          </TexturePreview>
          <button
            class="textures-panel__variant-add"
            title="Add variant"
            @click.stop="handleAddTextureToGroup(group.id)"
          >
            <Plus class="textures-panel__variant-add-icon" />
          </button>
          <input
            :ref="(el) => setAddToGroupReference(group.id, el)"
            type="file"
            accept="image/*"
            style="display: none"
            @change="(e) => handleGroupFileChange(group.id, e)"
          />
        </div>
      </div>
    </div>

    <div v-else class="textures-panel__empty">
      <p class="textures-panel__empty-title">No textures added yet</p>
      <p class="textures-panel__empty-hint">Click "Add Texture" to get started</p>
    </div>
  </GenericPanel>
</template>

<style scoped>
.textures-panel__toolbar {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-2);
}

.textures-panel__add-btn {
  flex: 1;
}

.textures-panel__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  min-height: 0;
}

.textures-panel__group {
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-muted) 30%, transparent);
  transition: background 150ms, border-color 150ms;
}

.textures-panel__group--selected {
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
}

.textures-panel__group--hidden {
  opacity: var(--opacity-muted);
}

.textures-panel__group-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  cursor: pointer;
}

.textures-panel__group-info {
  flex: 1;
  min-width: 0;
}

.textures-panel__group-name {
  font-size: var(--font-size-xs);
  font-weight: 500;
  font-family: monospace;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.textures-panel__group-actions {
  display: flex;
  gap: var(--spacing-1);
  flex-shrink: 0;
}

.textures-panel__variants {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1-5);
  padding: 0 var(--spacing-3) var(--spacing-3);
}

.textures-panel__variant-preview {
  width: var(--thumbnail-size);
  height: var(--thumbnail-size);
  min-width: var(--thumbnail-size);
  min-height: var(--thumbnail-size);
  max-width: var(--thumbnail-size);
  max-height: var(--thumbnail-size);
}

.textures-panel__variant-remove {
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

.textures-panel__variant-preview:hover .textures-panel__variant-remove {
  opacity: 1;
}

.textures-panel__variant-remove-icon {
  width: var(--font-size-sm);
  height: var(--font-size-sm);
}

.textures-panel__variant-add {
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

.textures-panel__variant-add:hover {
  background: var(--color-accent);
}

.textures-panel__variant-add-icon {
  width: var(--font-size-md);
  height: var(--font-size-md);
}

.textures-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  padding: var(--spacing-12) 0;
  text-align: center;
}

.textures-panel__empty-title {
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
  margin: 0;
}

.textures-panel__empty-hint {
  font-size: var(--font-size-2xs);
  color: var(--color-muted-foreground);
  opacity: var(--opacity-muted);
  margin: 0;
}
</style>
