<script setup lang="ts">
import { ref } from "vue";
import { Eye, EyeOff, Trash2, Box } from "lucide-vue-next";
import GenericPanel from "./GenericPanel.vue";
import { Button } from "@/components/ui/button";
import TexturePreview from "@/components/TexturePreview.vue";

interface TextureItem {
  id: string;
  name: string;
  filename: string;
  url: string;
  hidden?: boolean;
  showWireframe?: boolean;
}

interface Props {
  textureItems: TextureItem[];
  selectedTextureId: string | null;
}

interface Emits {
  (e: "select", id: string): void;
  (e: "remove", id: string): void;
  (e: "toggle-visibility", id: string): void;
  (e: "toggle-wireframe", id: string): void;
  (e: "fileChange", event: Event): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const fileInputRef = ref<HTMLInputElement | null>(null);

const handleAddClick = () => {
  fileInputRef.value?.click();
};

const handleFileChange = (event: Event) => {
  emit("fileChange", event);
};

const handleSelectTexture = (id: string) => {
  emit("select", id);
};

const handleRemoveTexture = (id: string, event: Event) => {
  event.stopPropagation();
  emit("remove", id);
};

const handleToggleVisibility = (id: string, event: Event) => {
  event.stopPropagation();
  emit("toggle-visibility", id);
};

const handleToggleWireframe = (id: string, event: Event) => {
  event.stopPropagation();
  emit("toggle-wireframe", id);
};
</script>

<template>
  <GenericPanel panel-type="textures" side="left">
    <div class="textures-panel flex flex-col h-full">
      <div class="textures-panel__header p-4 border-b border-white/10">
        <h2 class="text-lg font-semibold text-white">Textures</h2>
      </div>

      <div class="textures-panel__content flex-1 p-4 overflow-y-auto flex flex-col gap-4">
        <!-- Add texture button -->
        <Button variant="default" class="w-full" @click="handleAddClick">
          ➕ Add Texture
        </Button>

        <!-- Hidden file input -->
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          @change="handleFileChange"
          style="display: none"
        />

        <!-- Texture list -->
        <div
          v-if="textureItems.length > 0"
          class="textures-panel__list flex flex-col gap-2"
        >
          <div
            v-for="item in textureItems"
            :key="item.id"
            class="textures-panel__item group relative flex items-center gap-4 p-3 rounded-lg border transition-all cursor-pointer"
            :class="[
              selectedTextureId === item.id
                ? 'bg-primary/20 border-primary/60'
                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20',
              item.hidden && 'opacity-50',
            ]"
            @click="handleSelectTexture(item.id)"
          >
            <TexturePreview
              :src="item.url"
              :alt="item.name"
              :class="{ 'ring-2 ring-primary ring-offset-1 ring-offset-transparent rounded': selectedTextureId === item.id }"
            />
            <div class="textures-panel__info flex-1 min-w-0">
              <span class="text-xs text-white/90 font-mono truncate block">{{
                item.name
              }}</span>
            </div>
            <div class="textures-panel__actions flex gap-1 shrink-0">
              <Button
                :variant="item.hidden ? 'default' : 'ghost'"
                size="icon"
                class="h-8 w-8"
                :class="{ 'bg-primary/20 hover:bg-primary/30': item.hidden }"
                :title="item.hidden ? 'Show texture' : 'Hide texture'"
                @click="(e: Event) => handleToggleVisibility(item.id, e)"
              >
                <EyeOff v-if="item.hidden" class="h-4 w-4" />
                <Eye v-else class="h-4 w-4" />
              </Button>
              <Button
                :variant="item.showWireframe ? 'default' : 'ghost'"
                size="icon"
                class="h-8 w-8"
                :class="{ 'bg-primary/20 hover:bg-primary/30': item.showWireframe }"
                :title="item.showWireframe ? 'Hide wireframe' : 'Show wireframe'"
                @click="(e: Event) => handleToggleWireframe(item.id, e)"
              >
                <Box class="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                title="Delete texture"
                @click="(e: Event) => handleRemoveTexture(item.id, e)"
              >
                <Trash2 class="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-else
          class="textures-panel__empty flex flex-col items-center justify-center gap-2 py-12 text-center"
        >
          <p class="text-sm text-white/50">No textures added yet</p>
          <p class="text-xs text-white/30">Click "Add Texture" to get started</p>
        </div>
      </div>
    </div>
  </GenericPanel>
</template>

<style scoped>
.textures-panel {
  min-height: 0;
}

.textures-panel__content {
  min-height: 0;
}

.textures-panel__list {
  min-height: 0;
}
</style>
