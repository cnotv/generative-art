<script setup lang="ts">
import { computed, ref } from "vue";
import GenericPanel from "./GenericPanel.vue";
import SchemaControls from "./ConfigControls.vue";
import ElementItem from "./ElementItem.vue";
import ElementCamera from "./ElementCamera.vue";
import ElementGroup from "./ElementGroup.vue";
import { Button } from "@/components/ui/button";
import { Box, Camera, Image } from "lucide-vue-next";
import type { Component } from "vue";
import { useDebugSceneStore } from "@/stores/debugScene";
import { useElementPropertiesStore } from "@/stores/elementProperties";
import { storeToRefs } from "pinia";
import { useTextureGroupsStore } from "@/stores/textureGroups";
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

const elementPropertiesStore = useElementPropertiesStore();
const { selectedElementName, activeProperties } = storeToRefs(elementPropertiesStore);
const { openElementProperties } = elementPropertiesStore;
const textureStore = useTextureGroupsStore();

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

type AddElementType = "camera" | "mesh" | "textureArea";

const addElement = (type: AddElementType) => {
  if (type === "textureArea") {
    triggerFileUpload((e) => textureStore.handlers?.onAddNewGroup(e));
  } else {
    textureStore.handlers?.onAddElement(type);
  }
};

interface AddButton {
  type: AddElementType;
  icon: Component;
  label: string;
  title: string;
}

const addButtons: AddButton[] = [
  { type: "camera", icon: Camera, label: "Camera", title: "Add Camera" },
  { type: "mesh", icon: Box, label: "Mesh", title: "Add Mesh" },
  { type: "textureArea", icon: Image, label: "Texture", title: "Add Texture Area" },
];

const isCameraExpanded = computed(() => {
  if (!expandedName.value) return false;
  if (activeProperties.value?.type === "camera") return true;
  return (
    sceneElements.value
      .find((e) => e.name === expandedName.value)
      ?.type.includes("Camera") ?? false
  );
});

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

const hasContent = computed(
  () => sceneElements.value.length > 0 || textureStore.groups.length > 0
);

const hasExpandedSchema = computed(
  () => Object.keys(activeProperties.value?.schema ?? {}).length > 0
);
</script>

<template>
  <GenericPanel panel-type="elements" side="left">
    <!-- Add bar -->
    <div class="elements-panel__add-bar">
      <span class="elements-panel__add-label">Add</span>
      <Button
        v-for="btn in addButtons"
        :key="btn.type"
        variant="outline"
        size="sm"
        class="elements-panel__add-btn"
        :title="btn.title"
        @click="addElement(btn.type)"
      >
        <component :is="btn.icon" class="h-3 w-3 mr-1" />{{ btn.label }}
      </Button>
    </div>

    <p v-if="!hasContent" class="elements-panel__empty">No scene elements.</p>

    <div v-else class="elements-panel__list">
      <!-- Ungrouped scene elements -->
      <div
        v-for="(element, index) in grouped.ungrouped"
        :key="index"
        class="elements-panel__item"
        :class="{ 'opacity-50': element.hidden }"
      >
        <ElementItem
          :element="element"
          :selected="selectedElementName === element.name || expandedName === element.name"
          @click="handleElementClick(element)"
          @toggle-visibility="debugSceneStore.handleToggleVisibility(element.name)"
          @remove="debugSceneStore.handleRemove(element.name)"
        />

        <div v-if="expandedName === element.name" class="elements-panel__item-content">
          <ElementCamera
            v-if="isCameraExpanded"
            :is-recording="isRecording"
            :min-duration-ms="minDurationMs"
            :max-duration-ms="maxDurationMs"
            @start="(ms: number) => emit('start', ms)"
            @stop="emit('stop')"
          />
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

      <!-- Texture groups -->
      <ElementGroup
        v-for="[groupId] in grouped.meshGroups"
        :key="groupId"
        :group-id="groupId"
        :label="sceneGroups[groupId] ?? `Group ${groupId.slice(0, 6)}`"
        :is-expanded="expandedName === groupId"
        :is-selected="selectedElementName === groupId"
        :children="grouped.meshGroups.get(groupId)"
        @toggle="handleGroupToggle(groupId)"
      />
    </div>
  </GenericPanel>
</template>

<style scoped>
.elements-panel__add-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-1-5);
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--spacing-1-5);
  flex-wrap: wrap;
}

.elements-panel__add-label {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  flex-shrink: 0;
}

.elements-panel__add-btn {
  height: var(--btn-sm-height);
  padding: 0 var(--spacing-2);
  font-size: var(--font-size-xs);
  gap: var(--spacing-1);
}

.elements-panel__empty {
  font-size: var(--font-size-base);
  color: var(--color-foreground);
  opacity: var(--opacity-muted);
  margin: 0;
  padding: var(--spacing-2) 0;
}

.elements-panel__no-props {
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  opacity: var(--opacity-muted);
  padding: var(--spacing-2) var(--spacing-1);
  margin: 0;
}

.elements-panel__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.elements-panel__item {
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.elements-panel__item-content {
  border-top: 1px solid var(--color-border);
  padding: var(--spacing-2);
  background: var(--panel-content-bg);
}
</style>
