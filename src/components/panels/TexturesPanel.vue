<script setup lang="ts">
import { ref } from "vue";
import {
  Eye,
  EyeOff,
  Trash2,
  Box,
  Play,
  RefreshCw,
  Plus,
} from "lucide-vue-next";
import GenericPanel from "./GenericPanel.vue";
import { Button } from "@/components/ui/button";
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

interface Props {
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

const props = withDefaults(defineProps<Props>(), {
  autoUpdate: true,
});
const emit = defineEmits<Emits>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const addToGroupInputRefs = ref<Record<string, HTMLInputElement | null>>({});

const handleAddClick = () => {
  fileInputRef.value?.click();
};

const handleFileChange = (event: Event) => {
  emit("fileChange", event);
};

const handleAddTextureToGroup = (groupId: string) => {
  const input = addToGroupInputRefs.value[groupId];
  input?.click();
};

const handleGroupFileChange = (groupId: string, event: Event) => {
  emit("addTexture", groupId, event);
};

const setAddToGroupRef = (groupId: string, el: any) => {
  addToGroupInputRefs.value[groupId] = el;
};
</script>

<template>
  <GenericPanel panel-type="textures" side="left">
        <!-- Action buttons -->
        <div class="flex gap-2">
          <Button variant="default" class="flex-1" @click="handleAddClick">
            Add Texture
          </Button>
          <Button
            variant="ghost"
            size="icon"
            :class="props.autoUpdate ? 'btn--toggle btn--toggle--active' : 'btn--toggle'"
            title="Auto Update"
            @click="emit('update:autoUpdate', !props.autoUpdate)"
          >
            <RefreshCw class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-10 w-10 shrink-0"
            title="Update Now"
            @click="emit('manualUpdate')"
          >
            <Play class="h-4 w-4" />
          </Button>
        </div>

        <!-- Hidden file input for new group -->
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          style="display: none"
          @change="handleFileChange"
        />

        <!-- Texture group list -->
        <div
          v-if="textureGroups.length > 0"
          class="textures-panel__list flex flex-col gap-2"
        >
          <div
            v-for="group in textureGroups"
            :key="group.id"
            class="textures-panel__group rounded-lg border transition-all"
            :class="[
              selectedGroupId === group.id
                ? 'bg-primary/20 border-primary/60'
                : 'bg-muted/30 border-border hover:bg-muted/50 hover:border-border',
              group.hidden && 'textures-panel__group--hidden',
            ]"
          >
            <!-- Group header -->
            <div
              class="textures-panel__group-header flex items-center gap-3 p-3 cursor-pointer"
              @click="emit('selectGroup', group.id)"
            >
              <div class="textures-panel__info flex-1 min-w-0">
                <span
                  class="text-[11px] font-medium font-mono truncate block"
                  >{{ group.name }}</span
                >
              </div>
              <div class="textures-panel__actions flex gap-1 shrink-0">
                <Button
                  :variant="group.hidden ? 'default' : 'ghost'"
                  size="icon"
                  :class="
                    group.hidden
                      ? 'h-8 w-8 textures-panel__actions-btn--active'
                      : 'h-8 w-8'
                  "
                  :title="group.hidden ? 'Show group' : 'Hide group'"
                  @click.stop="emit('toggleVisibility', group.id)"
                >
                  <EyeOff v-if="group.hidden" class="h-4 w-4" />
                  <Eye v-else class="h-4 w-4" />
                </Button>
                <Button
                  :variant="group.showWireframe ? 'default' : 'ghost'"
                  size="icon"
                  :class="
                    group.showWireframe
                      ? 'h-8 w-8 textures-panel__actions-btn--active'
                      : 'h-8 w-8'
                  "
                  :title="
                    group.showWireframe ? 'Hide wireframe' : 'Show wireframe'
                  "
                  @click.stop="emit('toggleWireframe', group.id)"
                >
                  <Box class="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8"
                  title="Delete group"
                  @click.stop="emit('removeGroup', group.id)"
                >
                  <Trash2 class="h-4 w-4 " />
                </Button>
              </div>
            </div>

            <!-- Texture previews -->
            <div class="textures-panel__variants p-3 pt-0">
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
                  @click.stop="
                    emit('removeTexture', group.id, texture.id)
                  "
                >
                  <Trash2 class="h-2.5 w-2.5" />
                </button>
              </TexturePreview>
              <button
                class="textures-panel__variant-add"
                title="Add variant"
                @click.stop="handleAddTextureToGroup(group.id)"
              >
                <Plus class="h-4 w-4" />
              </button>
              <input
                :ref="(el) => setAddToGroupRef(group.id, el)"
                type="file"
                accept="image/*"
                style="display: none"
                @change="(e) => handleGroupFileChange(group.id, e)"
              />
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-else
          class="textures-panel__empty flex flex-col items-center justify-center gap-2 py-12 text-center"
        >
          <p class="text-sm text-white/50">No textures added yet</p>
          <p class="text-xs text-white/30">
            Click "Add Texture" to get started
          </p>
        </div>
  </GenericPanel>
</template>

<style scoped>
.textures-panel__list {
  min-height: 0;
}

.textures-panel__group--hidden {
  opacity: 0.5;
}

.textures-panel__variants {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.textures-panel__variant-preview {
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  max-width: 40px;
  max-height: 40px;
}

.textures-panel__variant-remove {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(0 0% 0% / 0.6);
  color: hsl(0 80% 65%);
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
  z-index: 2;
  transition: opacity 0.15s;
}

.textures-panel__variant-preview:hover .textures-panel__variant-remove {
  opacity: 1;
}

.textures-panel__variant-add {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-muted);
  color: var(--color-muted-foreground);
  cursor: pointer;
  border: 1px dashed var(--color-border);
  border-radius: 4px;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.15s;
}

.textures-panel__variant-add:hover {
  background: var(--color-accent);
}

:deep(.btn--toggle--active) {
  background-color: hsl(0 0% 83%);
  color: var(--color-accent-foreground);
}

:deep(.textures-panel__actions-btn--active) {
  background-color: hsl(0 0% 83%);
  color: var(--color-foreground);
}

@media (prefers-color-scheme: dark) {
  :deep(.btn--toggle--active) {
    background-color: hsl(0 0% 25%);
  }

  :deep(.textures-panel__actions-btn--active) {
    background-color: hsl(0 0% 25%);
  }
}
</style>
