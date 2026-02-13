<script setup lang="ts">
import { ref } from 'vue';
import GenericPanel from './GenericPanel.vue';
import { Button } from '@/components/ui/button';

interface TextureItem {
  id: string;
  name: string;
  filename: string;
  url: string;
}

interface Props {
  textureItems: TextureItem[];
  selectedTextureId: string | null;
}

interface Emits {
  (e: 'select', id: string): void;
  (e: 'remove', id: string): void;
  (e: 'fileChange', event: Event): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const fileInputRef = ref<HTMLInputElement | null>(null);

const handleAddClick = () => {
  fileInputRef.value?.click();
};

const handleFileChange = (event: Event) => {
  emit('fileChange', event);
};

const handleSelectTexture = (id: string) => {
  emit('select', id);
};

const handleRemoveTexture = (id: string, event: Event) => {
  event.stopPropagation();
  emit('remove', id);
};
</script>

<template>
  <GenericPanel
    panel-type="textures"
    side="left"
  >
    <div class="textures-panel flex flex-col h-full">
      <div class="textures-panel__header p-4 border-b border-white/10">
        <h2 class="text-lg font-semibold text-white">Textures</h2>
      </div>

      <div class="textures-panel__content flex-1 p-4 overflow-y-auto flex flex-col gap-4">
        <!-- Add texture button -->
        <Button
          variant="default"
          class="w-full"
          @click="handleAddClick"
        >
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
        <div v-if="textureItems.length > 0" class="textures-panel__list flex flex-col gap-2">
          <div
            v-for="item in textureItems"
            :key="item.id"
            class="textures-panel__item group relative flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer"
            :class="[
              selectedTextureId === item.id
                ? 'bg-primary/20 border-primary/60'
                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
            ]"
            @click="handleSelectTexture(item.id)"
          >
            <div class="textures-panel__preview">
              <img
                :src="item.url"
                :alt="item.name"
                class="w-12 h-12 object-cover rounded bg-white/10"
              />
            </div>
            <div class="textures-panel__info flex-1 min-w-0">
              <span class="text-sm text-white font-mono truncate block">{{ item.name }}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="textures-panel__remove opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              @click="(e) => handleRemoveTexture(item.id, e)"
            >
              <span class="text-destructive">✕</span>
            </Button>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="textures-panel__empty flex flex-col items-center justify-center gap-2 py-12 text-center">
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
