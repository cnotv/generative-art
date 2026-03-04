<script setup lang="ts">
import { computed, ref } from "vue";
import GenericPanel from "./GenericPanel.vue";
import SchemaControls from "./ConfigControls.vue";
import RecordingControls from "@/components/RecordingControls.vue";
import TexturePreview from "@/components/TexturePreview.vue";
import IconPreview from "@/components/IconPreview.vue";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Box,
  Lightbulb,
  Sun,
  Mountain,
  Image,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  RefreshCw,
  Play,
  Camera,
} from "lucide-vue-next";
import { useDebugSceneStore } from "@/stores/debugScene";
import { useElementPropertiesStore } from "@/stores/elementProperties";
import { storeToRefs } from "pinia";
import { useTextureGroupsStore } from "@/stores/textureGroups";
import { useCameraConfigStore } from "@/stores/cameraConfig";
import { CameraPreset, cameraPresets } from "@webgamekit/threejs";
import type { SceneElement } from "@/stores/debugScene";

interface Props {
  isRecording?: boolean;
  minDurationMs?: number;
  maxDurationMs?: number;
}

interface Emits {
  (e: "start", durationMs: number): void;
  (e: "stop"): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const debugSceneStore = useDebugSceneStore();
const { sceneElements, sceneGroups } = storeToRefs(debugSceneStore);
const toggleElementVisibility = debugSceneStore.handleToggleVisibility;
const removeElement = debugSceneStore.handleRemove;

const elementPropertiesStore = useElementPropertiesStore();
const { selectedElementName, activeProperties } = storeToRefs(elementPropertiesStore);
const { openElementProperties } = elementPropertiesStore;
const textureStore = useTextureGroupsStore();
const cameraConfigStore = useCameraConfigStore();
const { activeSlot } = storeToRefs(cameraConfigStore);
const { applyPresetToActiveSlot } = cameraConfigStore;

// Which element/group is currently expanded (single at a time)
const expandedName = ref<string | null>(null);

const triggerFileUpload = (onchange: (event: Event) => void) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = onchange;
  input.click();
};

const handleElementClick = (element: SceneElement) => {
  expandedName.value = expandedName.value === element.name ? null : element.name;
  if (expandedName.value) openElementProperties(element.name);
};

const handleGroupToggle = (groupId: string) => {
  expandedName.value = expandedName.value === groupId ? null : groupId;
  if (expandedName.value) {
    openElementProperties(groupId);
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

const addElement = (type: "camera" | "mesh" | "textureArea") => {
  if (type === "textureArea") {
    triggerFileUpload((e) => textureStore.handlers?.onAddNewGroup(e));
  } else {
    textureStore.handlers?.onAddElement(type);
  }
};

const handleAddTextureVariant = (groupId: string) => {
  triggerFileUpload((e) => textureStore.handlers?.onAddTextureToGroup(groupId, e));
};

// Camera preset logic
const isCameraExpanded = computed(() => {
  if (!expandedName.value) return false;
  if (activeProperties.value?.type === "camera") return true;
  return (
    sceneElements.value
      .find((e) => e.name === expandedName.value)
      ?.type.includes("Camera") ?? false
  );
});

const presetLabels: Record<CameraPreset, string> = {
  [CameraPreset.Perspective]: "Perspective",
  [CameraPreset.Fisheye]: "Fisheye",
  [CameraPreset.Cinematic]: "Cinematic",
  [CameraPreset.Orbit]: "Orbit",
  [CameraPreset.Orthographic]: "Orthographic",
  [CameraPreset.OrthographicFollowing]: "Ortho Follow",
  [CameraPreset.TopDown]: "Top Down",
};

const activePresetType = computed<"perspective" | "orthographic">(() =>
  activeSlot.value ? cameraPresets[activeSlot.value.preset].type : "perspective"
);

const perspectivePresets = computed(() =>
  (Object.entries(presetLabels) as [CameraPreset, string][]).filter(
    ([preset]) => cameraPresets[preset].type === "perspective"
  )
);

const orthographicPresets = computed(() =>
  (Object.entries(presetLabels) as [CameraPreset, string][]).filter(
    ([preset]) => cameraPresets[preset].type === "orthographic"
  )
);

const filteredPresets = computed(() =>
  activePresetType.value === "perspective"
    ? perspectivePresets.value
    : orthographicPresets.value
);

const handleTypeToggle = (type: "perspective" | "orthographic") => {
  const presets =
    type === "perspective" ? perspectivePresets.value : orthographicPresets.value;
  if (presets.length > 0) applyPresetToActiveSlot(presets[0][0]);
};

// Grouping logic
const grouped = computed(() => {
  const ungrouped: SceneElement[] = [];
  const meshGroups = new Map<string, SceneElement[]>();

  sceneElements.value.forEach((el) => {
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
  textureStore.groups.find((g) => g.id === groupId);

const hasContent = computed(
  () => sceneElements.value.length > 0 || textureStore.groups.length > 0
);

const hasExpandedSchema = computed(
  () => Object.keys(activeProperties.value?.schema ?? {}).length > 0
);

const getElementIcon = (element: SceneElement) => {
  const name = element.name.toLowerCase();
  const type = element.type.toLowerCase();
  if (name.includes("camera") || type.includes("camera")) return Camera;
  if (name.includes("light") || type.includes("light")) return Lightbulb;
  if (name.includes("sky")) return Sun;
  if (name.includes("ground")) return Mountain;
  if (type.includes("mesh") || name.includes("wireframe")) return Box;
  return Image;
};

const getElementColor = (element: SceneElement) => {
  const name = element.name.toLowerCase();
  const type = element.type.toLowerCase();
  if (name.includes("camera") || type.includes("camera")) return "text-blue-300";
  if (name.includes("light") || type.includes("light")) return "text-yellow-400";
  if (name.includes("sky")) return "text-blue-400";
  if (name.includes("ground")) return "text-green-600";
  if (name.includes("wireframe")) return "text-green-400";
  return "text-gray-400";
};
</script>

<template>
  <GenericPanel panel-type="elements" side="left">
    <!-- Add bar -->
    <div class="elements-panel__add-bar">
      <span class="elements-panel__add-label">Add</span>
      <Button
        variant="outline"
        size="sm"
        class="elements-panel__add-btn"
        title="Add Camera"
        @click="addElement('camera')"
      >
        <Camera class="h-3 w-3 mr-1" />Camera
      </Button>
      <Button
        variant="outline"
        size="sm"
        class="elements-panel__add-btn"
        title="Add Mesh"
        @click="addElement('mesh')"
      >
        <Box class="h-3 w-3 mr-1" />Mesh
      </Button>
      <Button
        variant="outline"
        size="sm"
        class="elements-panel__add-btn"
        title="Add Texture Area"
        @click="addElement('textureArea')"
      >
        <Image class="h-3 w-3 mr-1" />Texture
      </Button>
    </div>

    <p v-if="!hasContent" class="elements-panel__empty">No scene elements.</p>

    <div v-else class="elements-panel__list">
      <!-- Ungrouped scene elements -->
      <div
        v-for="(element, index) in grouped.ungrouped"
        :key="index"
        class="elements-panel__item"
        :class="{
          'elements-panel__item--expanded': expandedName === element.name,
          'opacity-50': element.hidden,
        }"
      >
        <div
          class="elements-panel__item-header"
          :class="{
            'elements-panel__item-header--selected': selectedElementName === element.name,
          }"
          @click="handleElementClick(element)"
        >
          <IconPreview
            :icon="getElementIcon(element)"
            :color="getElementColor(element)"
          />
          <div class="flex-1 min-w-0 flex flex-col gap-0.5">
            <span class="text-[11px] font-medium font-mono truncate block">{{
              element.name
            }}</span>
            <span class="text-[9px] text-muted-foreground truncate block">{{
              element.type
            }}</span>
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
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7"
              title="Remove element"
              @click="(e: Event) => handleRemove(element.name, e)"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <!-- Inline expanded content -->
        <div v-if="expandedName === element.name" class="elements-panel__item-content">
          <template v-if="isCameraExpanded">
            <Accordion
              type="multiple"
              :default-value="['presets', 'properties', 'recording']"
            >
              <AccordionItem value="presets">
                <AccordionTrigger>Presets</AccordionTrigger>
                <AccordionContent>
                  <div class="elements-panel__type-toggle">
                    <Button
                      :variant="
                        activePresetType === 'perspective' ? 'default' : 'outline'
                      "
                      size="sm"
                      class="w-full text-xs"
                      @click="handleTypeToggle('perspective')"
                      >Perspective</Button
                    >
                    <Button
                      :variant="
                        activePresetType === 'orthographic' ? 'default' : 'outline'
                      "
                      size="sm"
                      class="w-full text-xs"
                      @click="handleTypeToggle('orthographic')"
                      >Orthographic</Button
                    >
                  </div>
                  <div class="elements-panel__preset-grid">
                    <Button
                      v-for="[preset, label] in filteredPresets"
                      :key="preset"
                      :variant="activeSlot?.preset === preset ? 'default' : 'outline'"
                      size="sm"
                      class="text-xs"
                      @click="applyPresetToActiveSlot(preset)"
                      >{{ label }}</Button
                    >
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
          <IconPreview :icon="Box" color="text-gray-400" />
          <span class="elements-panel__group-label">
            {{ sceneGroups[groupId] ?? `Group ${groupId.slice(0, 6)}` }}
          </span>
          <template v-if="getTextureGroup(groupId)">
            <Button
              :variant="getTextureGroup(groupId)?.hidden ? 'default' : 'ghost'"
              size="icon"
              class="h-7 w-7 shrink-0"
              :title="getTextureGroup(groupId)?.hidden ? 'Show group' : 'Hide group'"
              @click.stop="textureStore.handlers?.onToggleVisibility(groupId)"
            >
              <EyeOff v-if="getTextureGroup(groupId)?.hidden" class="h-3.5 w-3.5" />
              <Eye v-else class="h-3.5 w-3.5" />
            </Button>
            <Button
              :variant="getTextureGroup(groupId)?.showWireframe ? 'default' : 'ghost'"
              size="icon"
              class="h-7 w-7 shrink-0"
              :title="
                getTextureGroup(groupId)?.showWireframe
                  ? 'Hide wireframe'
                  : 'Show wireframe'
              "
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
                  @click.stop="
                    textureStore.handlers?.onRemoveTexture(groupId, texture.id)
                  "
                >
                  <Trash2 class="h-2.5 w-2.5" />
                </button>
              </TexturePreview>
              <button
                class="elements-panel__variant-add"
                title="Add variant"
                @click.stop="handleAddTextureVariant(groupId)"
              >
                <Plus class="h-4 w-4" />
              </button>
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
              <Button
                variant="ghost"
                size="icon"
                title="Update Now"
                @click="textureStore.handlers?.onManualUpdate()"
              >
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
                <IconPreview
                  :icon="getElementIcon(child)"
                  :color="getElementColor(child)"
                />
                <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span class="text-[11px] font-medium font-mono truncate block">{{
                    child.name
                  }}</span>
                  <span class="text-[9px] text-muted-foreground truncate block">{{
                    child.type
                  }}</span>
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

<style scoped lang="scss">
// ─── Layout ───────────────────────────────────────────────────────────────────
$gap-xs:  0.25rem;
$gap-sm:  0.375rem;
$gap-md:  0.5rem;

// ─── Typography ───────────────────────────────────────────────────────────────
$font-size-label:  0.6875rem;
$font-size-empty:  0.875rem;
$font-size-group:  0.75rem;
$font-weight-group: 500;

// ─── Component sizes ──────────────────────────────────────────────────────────
$btn-height:       1.75rem;
$variant-size:     40px;
$variant-gap:      6px;
$variant-radius:   4px;
$variant-remove-z: 2;

// ─── Transitions ──────────────────────────────────────────────────────────────
$transition-bg:      background-color 150ms;
$transition-bg-full: background 0.15s;
$transition-opacity: opacity 0.15s;

// ─── Opacity ──────────────────────────────────────────────────────────────────
$opacity-muted: 0.5;

// ─── Colors — light ───────────────────────────────────────────────────────────
$bg-item:          hsl(0 0% 98%);
$bg-hover:         hsl(0 0% 94%);
$bg-selected:      hsl(0 0% 90%);
$bg-content:       hsl(0 0% 97%);
$bg-toggle-active: hsl(0 0% 83%);
$bg-overlay:       hsl(0 0% 0% / 0.6);
$color-remove:     hsl(0 80% 65%);

// ─── Colors — dark ────────────────────────────────────────────────────────────
$bg-item-dark:          hsl(0 0% 12%);
$bg-hover-dark:         hsl(0 0% 18%);
$bg-selected-dark:      hsl(0 0% 22%);
$bg-content-dark:       hsl(0 0% 10%);
$bg-toggle-active-dark: hsl(0 0% 25%);

// ─── Rules ────────────────────────────────────────────────────────────────────
.elements-panel__add-bar {
  display: flex;
  align-items: center;
  gap: $gap-sm;
  padding-bottom: $gap-md;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: $gap-sm;
  flex-wrap: wrap;
}

.elements-panel__add-label {
  font-size: $font-size-label;
  color: var(--color-muted-foreground);
  flex-shrink: 0;
}

.elements-panel__add-btn {
  height: $btn-height;
  padding: 0 $gap-md;
  font-size: $font-size-label;
  gap: $gap-xs;
}

.elements-panel__empty {
  font-size: $font-size-empty;
  color: var(--color-foreground);
  opacity: $opacity-muted;
  margin: 0;
  padding: $gap-md 0;
}

.elements-panel__no-props {
  font-size: $font-size-group;
  color: var(--color-foreground);
  opacity: $opacity-muted;
  padding: $gap-md $gap-xs;
  margin: 0;
}

.elements-panel__list {
  display: flex;
  flex-direction: column;
  gap: $gap-xs;
}

.elements-panel__item {
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.elements-panel__item-header {
  display: flex;
  align-items: center;
  gap: $gap-sm;
  padding: $gap-sm $gap-md;
  cursor: pointer;
  background: $bg-item;
  transition: $transition-bg;
}

.elements-panel__item-header:hover {
  background-color: $bg-hover;
}

.elements-panel__item-header--selected,
.elements-panel__item--expanded > .elements-panel__item-header {
  background-color: $bg-selected;
}

.elements-panel__item-content {
  border-top: 1px solid var(--color-border);
  padding: $gap-md;
  background: $bg-content;
}

.elements-panel__type-toggle {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $gap-xs;
  margin-bottom: $gap-xs;
}

.elements-panel__preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $gap-xs;
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
  gap: $gap-sm;
  padding: $gap-sm $gap-md;
  background: transparent;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  color: var(--color-foreground);
  font-size: $font-size-group;
  font-weight: $font-weight-group;
  transition: $transition-bg;
}

.elements-panel__group-header:hover {
  background-color: $bg-hover;
}

.elements-panel__group-header--selected,
.elements-panel__group-header--expanded {
  background-color: $bg-selected;
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
  padding: $gap-md;
  background: $bg-content;
  display: flex;
  flex-direction: column;
  gap: $gap-md;
}

.elements-panel__group-children {
  display: flex;
  flex-direction: column;
  gap: $gap-xs;
}

.elements-panel__variants {
  display: flex;
  flex-wrap: wrap;
  gap: $variant-gap;
}

.elements-panel__variant-preview {
  width: $variant-size;
  height: $variant-size;
  min-width: $variant-size;
  min-height: $variant-size;
  max-width: $variant-size;
  max-height: $variant-size;
}

.elements-panel__variant-remove {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $bg-overlay;
  color: $color-remove;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
  z-index: $variant-remove-z;
  transition: $transition-opacity;
}

.elements-panel__variant-preview:hover .elements-panel__variant-remove {
  opacity: 1;
}

.elements-panel__variant-add {
  width: $variant-size;
  height: $variant-size;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-muted);
  color: var(--color-muted-foreground);
  cursor: pointer;
  border: 1px dashed var(--color-border);
  border-radius: $variant-radius;
  padding: 0;
  flex-shrink: 0;
  transition: $transition-bg-full;
}

.elements-panel__variant-add:hover {
  background: var(--color-accent);
}

.elements-panel__update-bar {
  display: flex;
  gap: $gap-xs;
  align-items: center;
}

.elements-panel__toggle--active {
  background-color: $bg-toggle-active;
  color: var(--color-accent-foreground);
}

@media (prefers-color-scheme: dark) {
  .elements-panel__item-header {
    background: $bg-item-dark;
  }

  .elements-panel__item-header:hover,
  .elements-panel__group-header:hover {
    background-color: $bg-hover-dark;
  }

  .elements-panel__item-header--selected,
  .elements-panel__item--expanded > .elements-panel__item-header,
  .elements-panel__group-header--selected,
  .elements-panel__group-header--expanded {
    background-color: $bg-selected-dark;
  }

  .elements-panel__item-content,
  .elements-panel__group-content {
    background: $bg-content-dark;
  }

  .elements-panel__toggle--active {
    background-color: $bg-toggle-active-dark;
  }
}
</style>
