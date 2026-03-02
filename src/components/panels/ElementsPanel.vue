<script setup lang="ts">
import { computed, ref } from 'vue';
import GenericPanel from './GenericPanel.vue';
import SchemaControls from './ConfigControls.vue';
import RecordingControls from '@/components/RecordingControls.vue';
import TexturePreview from '@/components/TexturePreview.vue';
import IconPreview from '@/components/IconPreview.vue';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import {
  Box,
  Lightbulb,
  Sun,
  Mountain,
  Image,
  Eye,
  EyeOff,
  Trash2,
  ChevronRight,
  ChevronDown,
  Plus,
  RefreshCw,
  Play,
  Camera,
} from 'lucide-vue-next';
import { useDebugScene } from '@/composables/useDebugScene';
import { useElementProperties } from '@/composables/useElementProperties';
import { useTextureGroupsStore } from '@/stores/textureGroups';
import { useCameraConfig } from '@/composables/useCameraConfig';
import { CameraPreset, cameraPresets } from '@webgamekit/threejs';
import type { SceneElement } from '@/composables/useDebugScene';

interface Props {
  isRecording?: boolean;
  minDurationMs?: number;
  maxDurationMs?: number;
}

interface Emits {
  (e: 'start', durationMs: number): void;
  (e: 'stop'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const {
  sceneElements,
  sceneGroups,
  handleToggleVisibility: toggleElementVisibility,
  handleRemove: removeElement,
} = useDebugScene();

const { openElementProperties, selectedElementName, activeProperties } = useElementProperties();
const textureStore = useTextureGroupsStore();
const { activeSlot, applyPresetToActiveSlot } = useCameraConfig();

// File inputs for texture uploads
const addGroupInputRef = ref<HTMLInputElement | null>(null);
const addToGroupInputRefs = ref<Record<string, HTMLInputElement | null>>({});

// Which element/group is currently expanded (single at a time)
const expandedName = ref<string | null>(null);

const handleElementClick = (element: SceneElement) => {
  expandedName.value = expandedName.value === element.name ? null : element.name;
  if (expandedName.value) openElementProperties(element.name);
};

const handleGroupToggle = (groupId: string) => {
  expandedName.value = expandedName.value === groupId ? null : groupId;
  if (expandedName.value) {
    openElementProperties(groupId);
    textureStore.selectedGroupId = groupId;
    textureStore.handlers?.onSelectGroup(groupId);
  }
};

const handleToggleVisibility = (name: string, event: Event) => {
  event.stopPropagation();
  toggleElementVisibility(name);
};

const handleRemove = (name: string, event: Event) => {
  event.stopPropagation();
  removeElement(name);
};

const addElement = (type: 'camera' | 'mesh' | 'textureArea') => {
  if (type === 'textureArea') {
    addGroupInputRef.value?.click();
  } else {
    textureStore.handlers?.onAddElement(type);
  }
};

const setAddToGroupRef = (groupId: string, el: unknown) => {
  addToGroupInputRefs.value[groupId] = el as HTMLInputElement | null;
};

const handleAddTextureVariant = (groupId: string) => {
  addToGroupInputRefs.value[groupId]?.click();
};

// Camera preset logic
const isCameraExpanded = computed(() => {
  if (!expandedName.value) return false;
  if (activeProperties.value?.type === 'camera') return true;
  return sceneElements.value.find(e => e.name === expandedName.value)?.type.includes('Camera') ?? false;
});

const presetLabels: Record<CameraPreset, string> = {
  [CameraPreset.Perspective]: 'Perspective',
  [CameraPreset.Fisheye]: 'Fisheye',
  [CameraPreset.Cinematic]: 'Cinematic',
  [CameraPreset.Orbit]: 'Orbit',
  [CameraPreset.Orthographic]: 'Orthographic',
  [CameraPreset.OrthographicFollowing]: 'Ortho Follow',
  [CameraPreset.TopDown]: 'Top Down',
};

const activePresetType = computed<'perspective' | 'orthographic'>(() =>
  activeSlot.value ? cameraPresets[activeSlot.value.preset].type : 'perspective'
);

const perspectivePresets = computed(() =>
  (Object.entries(presetLabels) as [CameraPreset, string][]).filter(
    ([preset]) => cameraPresets[preset].type === 'perspective'
  )
);

const orthographicPresets = computed(() =>
  (Object.entries(presetLabels) as [CameraPreset, string][]).filter(
    ([preset]) => cameraPresets[preset].type === 'orthographic'
  )
);

const filteredPresets = computed(() =>
  activePresetType.value === 'perspective' ? perspectivePresets.value : orthographicPresets.value
);

const handleTypeToggle = (type: 'perspective' | 'orthographic') => {
  const presets = type === 'perspective' ? perspectivePresets.value : orthographicPresets.value;
  if (presets.length > 0) applyPresetToActiveSlot(presets[0][0]);
};

// Grouping logic
const grouped = computed(() => {
  const ungrouped: SceneElement[] = [];
  const meshGroups = new Map<string, SceneElement[]>();

  sceneElements.value.forEach(el => {
    if (el.groupId !== undefined) {
      const existing = meshGroups.get(el.groupId) ?? [];
      meshGroups.set(el.groupId, [...existing, el]);
    } else {
      ungrouped.push(el);
    }
  });

  return { ungrouped, meshGroups };
});

const getTextureGroup = (groupId: string) =>
  textureStore.groups.find(g => g.id === groupId);

const hasContent = computed(
  () => sceneElements.value.length > 0 || textureStore.groups.length > 0
);

const hasExpandedSchema = computed(
  () => Object.keys(activeProperties.value?.schema ?? {}).length > 0
);

const getElementIcon = (element: SceneElement) => {
  const name = element.name.toLowerCase();
  const type = element.type.toLowerCase();
  if (name.includes('camera') || type.includes('camera')) return Camera;
  if (name.includes('light') || type.includes('light')) return Lightbulb;
  if (name.includes('sky')) return Sun;
  if (name.includes('ground')) return Mountain;
  if (type.includes('mesh') || name.includes('wireframe')) return Box;
  return Image;
};

const getElementColor = (element: SceneElement) => {
  const name = element.name.toLowerCase();
  const type = element.type.toLowerCase();
  if (name.includes('camera') || type.includes('camera')) return 'text-blue-300';
  if (name.includes('light') || type.includes('light')) return 'text-yellow-400';
  if (name.includes('sky')) return 'text-blue-400';
  if (name.includes('ground')) return 'text-green-600';
  if (name.includes('wireframe')) return 'text-green-400';
  return 'text-gray-400';
};
</script>

<template>
  <GenericPanel panel-type="elements" side="left">

    <!-- Add bar -->
    <div class="elements-panel__add-bar">
      <span class="elements-panel__add-label">Add</span>
      <Button variant="outline" size="sm" class="elements-panel__add-btn" title="Add Camera" @click="addElement('camera')">
        <Camera class="h-3 w-3 mr-1" />Camera
      </Button>
      <Button variant="outline" size="sm" class="elements-panel__add-btn" title="Add Mesh" @click="addElement('mesh')">
        <Box class="h-3 w-3 mr-1" />Mesh
      </Button>
      <Button variant="outline" size="sm" class="elements-panel__add-btn" title="Add Texture Area" @click="addElement('textureArea')">
        <Image class="h-3 w-3 mr-1" />Texture
      </Button>
    </div>

    <!-- Hidden file input for new texture group -->
    <input
      ref="addGroupInputRef"
      type="file"
      accept="image/*"
      style="display: none"
      @change="(e) => textureStore.handlers?.onAddNewGroup(e)"
    />

    <p v-if="!hasContent" class="elements-panel__empty">No scene elements.</p>

    <div v-else class="elements-panel__list">

      <!-- Ungrouped scene elements -->
      <div
        v-for="(element, index) in grouped.ungrouped"
        :key="index"
        class="elements-panel__item"
        :class="{ 'elements-panel__item--expanded': expandedName === element.name, 'opacity-50': element.hidden }"
      >
        <div
          class="elements-panel__item-header"
          :class="{ 'elements-panel__item-header--selected': selectedElementName === element.name }"
          @click="handleElementClick(element)"
        >
          <component :is="expandedName === element.name ? ChevronDown : ChevronRight" class="elements-panel__chevron" />
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
              @click="(e: Event) => handleToggleVisibility(element.name, e)"
            >
              <EyeOff v-if="element.hidden" class="h-3.5 w-3.5" />
              <Eye v-else class="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" class="h-7 w-7" title="Remove element" @click="(e: Event) => handleRemove(element.name, e)">
              <Trash2 class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <!-- Inline expanded content -->
        <div v-if="expandedName === element.name" class="elements-panel__item-content">
          <template v-if="isCameraExpanded">
            <Accordion type="multiple" :default-value="['presets', 'properties', 'recording']">
              <AccordionItem value="presets">
                <AccordionTrigger>Presets</AccordionTrigger>
                <AccordionContent>
                  <div class="elements-panel__type-toggle">
                    <Button
                      :variant="activePresetType === 'perspective' ? 'default' : 'outline'"
                      size="sm" class="w-full text-xs"
                      @click="handleTypeToggle('perspective')"
                    >Perspective</Button>
                    <Button
                      :variant="activePresetType === 'orthographic' ? 'default' : 'outline'"
                      size="sm" class="w-full text-xs"
                      @click="handleTypeToggle('orthographic')"
                    >Orthographic</Button>
                  </div>
                  <div class="elements-panel__preset-grid">
                    <Button
                      v-for="[preset, label] in filteredPresets"
                      :key="preset"
                      :variant="activeSlot?.preset === preset ? 'default' : 'outline'"
                      size="sm" class="text-xs"
                      @click="applyPresetToActiveSlot(preset)"
                    >{{ label }}</Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem v-if="hasExpandedSchema" value="properties">
                <AccordionTrigger>Properties</AccordionTrigger>
                <AccordionContent>
                  <SchemaControls
                    :schema="activeProperties!.schema"
                    :get-value="activeProperties!.getValue"
                    :on-update="activeProperties!.updateValue"
                  />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="recording">
                <AccordionTrigger>Recording</AccordionTrigger>
                <AccordionContent>
                  <RecordingControls
                    :is-recording="isRecording"
                    :min-duration-ms="minDurationMs"
                    :max-duration-ms="maxDurationMs"
                    @start="(ms: number) => emit('start', ms)"
                    @stop="emit('stop')"
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </template>
          <template v-else>
            <SchemaControls
              v-if="hasExpandedSchema"
              :schema="activeProperties!.schema"
              :get-value="activeProperties!.getValue"
              :on-update="activeProperties!.updateValue"
            />
            <p v-else class="elements-panel__no-props">No configurable properties.</p>
          </template>
        </div>
      </div>

      <!-- Texture groups (grouped mesh children) -->
      <div
        v-for="[groupId] in grouped.meshGroups"
        :key="groupId"
        class="elements-panel__group"
      >
        <button
          class="elements-panel__group-header"
          :class="{
            'elements-panel__group-header--selected': selectedElementName === groupId,
            'elements-panel__group-header--expanded': expandedName === groupId,
            'opacity-50': getTextureGroup(groupId)?.hidden,
          }"
          @click="handleGroupToggle(groupId)"
        >
          <component :is="expandedName === groupId ? ChevronDown : ChevronRight" class="elements-panel__chevron" />
          <Box class="elements-panel__group-icon" />
          <span class="elements-panel__group-label">
            {{ sceneGroups[groupId] ?? `Group ${groupId.slice(0, 6)}` }}
          </span>
          <template v-if="getTextureGroup(groupId)">
            <Button
              :variant="getTextureGroup(groupId)?.hidden ? 'default' : 'ghost'"
              size="icon" class="h-7 w-7 shrink-0"
              :title="getTextureGroup(groupId)?.hidden ? 'Show group' : 'Hide group'"
              @click.stop="textureStore.handlers?.onToggleVisibility(groupId)"
            >
              <EyeOff v-if="getTextureGroup(groupId)?.hidden" class="h-3.5 w-3.5" />
              <Eye v-else class="h-3.5 w-3.5" />
            </Button>
            <Button
              :variant="getTextureGroup(groupId)?.showWireframe ? 'default' : 'ghost'"
              size="icon" class="h-7 w-7 shrink-0"
              :title="getTextureGroup(groupId)?.showWireframe ? 'Hide wireframe' : 'Show wireframe'"
              @click.stop="textureStore.handlers?.onToggleWireframe(groupId)"
            >
              <Box class="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" class="h-7 w-7 shrink-0" title="Delete group"
              @click.stop="textureStore.handlers?.onRemoveGroup(groupId)"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </Button>
          </template>
        </button>

        <!-- Expanded texture group content -->
        <div v-if="expandedName === groupId" class="elements-panel__group-content">
          <template v-if="getTextureGroup(groupId)">
            <!-- Texture variant previews -->
            <div class="elements-panel__variants">
              <TexturePreview
                v-for="texture in getTextureGroup(groupId)!.textures"
                :key="texture.id"
                :src="texture.url"
                :alt="texture.name"
                class="elements-panel__variant-preview"
              >
                <button
                  class="elements-panel__variant-remove"
                  title="Remove texture"
                  @click.stop="textureStore.handlers?.onRemoveTexture(groupId, texture.id)"
                >
                  <Trash2 class="h-2.5 w-2.5" />
                </button>
              </TexturePreview>
              <button class="elements-panel__variant-add" title="Add variant" @click.stop="handleAddTextureVariant(groupId)">
                <Plus class="h-4 w-4" />
              </button>
              <input
                :ref="(el) => setAddToGroupRef(groupId, el)"
                type="file"
                accept="image/*"
                style="display: none"
                @change="(e) => textureStore.handlers?.onAddTextureToGroup(groupId, e)"
              />
            </div>

            <!-- Update controls inside the texture area -->
            <div class="elements-panel__update-bar">
              <Button
                variant="ghost"
                size="icon"
                :class="{ 'elements-panel__toggle--active': textureStore.autoUpdate }"
                title="Auto Update"
                @click="textureStore.autoUpdate = !textureStore.autoUpdate"
              >
                <RefreshCw class="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Update Now" @click="textureStore.handlers?.onManualUpdate()">
                <Play class="h-4 w-4" />
              </Button>
            </div>

            <!-- Properties -->
            <SchemaControls
              v-if="hasExpandedSchema"
              :schema="activeProperties!.schema"
              :get-value="activeProperties!.getValue"
              :on-update="activeProperties!.updateValue"
            />
          </template>

          <!-- Non-texture group fallback: list children -->
          <template v-else>
            <div class="elements-panel__group-children">
              <div
                v-for="(child, ci) in grouped.meshGroups.get(groupId)"
                :key="ci"
                class="flex items-center gap-2 p-1.5 rounded border border-border bg-muted/30"
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

    </div>
  </GenericPanel>
</template>

<style scoped>
.elements-panel__add-bar {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 0.375rem;
  flex-wrap: wrap;
}

.elements-panel__add-label {
  font-size: 0.6875rem;
  color: var(--color-muted-foreground);
  flex-shrink: 0;
}

.elements-panel__add-btn {
  height: 1.75rem;
  padding: 0 0.5rem;
  font-size: 0.6875rem;
  gap: 0.25rem;
}

.elements-panel__empty {
  font-size: 0.875rem;
  color: var(--color-foreground);
  opacity: 0.5;
  margin: 0;
  padding: 0.5rem 0;
}

.elements-panel__no-props {
  font-size: 0.75rem;
  color: var(--color-foreground);
  opacity: 0.5;
  padding: 0.5rem 0.25rem;
  margin: 0;
}

.elements-panel__list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.elements-panel__item {
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.elements-panel__item-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  cursor: pointer;
  background: hsl(0 0% 98%);
  transition: background-color 150ms;
}

.elements-panel__item-header:hover {
  background-color: hsl(0 0% 94%);
}

.elements-panel__item-header--selected,
.elements-panel__item--expanded > .elements-panel__item-header {
  background-color: hsl(0 0% 90%);
}

.elements-panel__item-content {
  border-top: 1px solid var(--color-border);
  padding: 0.5rem;
  background: hsl(0 0% 97%);
}

.elements-panel__chevron {
  width: 0.75rem;
  height: 0.75rem;
  flex-shrink: 0;
  opacity: 0.5;
}

.elements-panel__type-toggle {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.25rem;
  margin-bottom: 0.25rem;
}

.elements-panel__preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.25rem;
}

.elements-panel__group {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.elements-panel__group-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  color: var(--color-foreground);
  font-size: 0.75rem;
  font-weight: 500;
  transition: background-color 150ms;
}

.elements-panel__group-header:hover {
  background-color: hsl(0 0% 94%);
}

.elements-panel__group-header--selected,
.elements-panel__group-header--expanded {
  background-color: hsl(0 0% 90%);
}

.elements-panel__group-icon {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
  opacity: 0.5;
}

.elements-panel__group-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.elements-panel__group-content {
  border-top: 1px solid var(--color-border);
  padding: 0.5rem;
  background: hsl(0 0% 97%);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.elements-panel__group-children {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.elements-panel__variants {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.elements-panel__variant-preview {
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  max-width: 40px;
  max-height: 40px;
}

.elements-panel__variant-remove {
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

.elements-panel__variant-preview:hover .elements-panel__variant-remove {
  opacity: 1;
}

.elements-panel__variant-add {
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

.elements-panel__variant-add:hover {
  background: var(--color-accent);
}

.elements-panel__update-bar {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.elements-panel__toggle--active {
  background-color: hsl(0 0% 83%);
  color: var(--color-accent-foreground);
}

@media (prefers-color-scheme: dark) {
  .elements-panel__item-header {
    background: hsl(0 0% 12%);
  }

  .elements-panel__item-header:hover,
  .elements-panel__group-header:hover {
    background-color: hsl(0 0% 18%);
  }

  .elements-panel__item-header--selected,
  .elements-panel__item--expanded > .elements-panel__item-header,
  .elements-panel__group-header--selected,
  .elements-panel__group-header--expanded {
    background-color: hsl(0 0% 22%);
  }

  .elements-panel__item-content,
  .elements-panel__group-content {
    background: hsl(0 0% 10%);
  }

  .elements-panel__toggle--active {
    background-color: hsl(0 0% 25%);
  }
}
</style>
