<script setup lang="ts">
import { computed } from "vue";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { usePanels } from "@/composables/usePanels";
import { useViewConfig } from "@/composables/useViewConfig";
import SchemaControls from "./ConfigControls.vue";
import { Settings } from "lucide-vue-next";
import type { ConfigControlsSchema } from "@/composables/useViewConfig";

const props = withDefaults(
  defineProps<{
    schema?: ConfigControlsSchema | null;
    sceneSchema?: ConfigControlsSchema | null;
    getValue?: (path: string) => any;
    getSceneValue?: (path: string) => any;
    onUpdate?: (path: string, value: any) => void;
    onSceneUpdate?: (path: string, value: any) => void;
  }>(),
  {}
);

const { isConfigOpen, togglePanel, closePanel } = usePanels();
const viewConfig = useViewConfig();

// Renamed: activeSchema -> configSchema for clarity
const configSchema = () => props.schema ?? viewConfig.currentSchema.value;
const sceneSchema = () => props.sceneSchema ?? viewConfig.currentSceneSchema.value;

const configGetValue = (path: string) =>
  props.getValue?.(path) ?? viewConfig.getConfigValue(path);
const sceneGetValue = (path: string) =>
  props.getSceneValue?.(path) ?? viewConfig.getSceneConfigValue(path);

const configOnUpdate = (path: string, value: any) => {
  if (props.onUpdate) {
    props.onUpdate(path, value);
  } else {
    viewConfig.updateConfig(path, value);
  }
};

const sceneOnUpdate = (path: string, value: any) => {
  if (props.onSceneUpdate) {
    props.onSceneUpdate(path, value);
  } else {
    viewConfig.updateSceneConfig(path, value);
  }
};

// Define tabs programmatically
const tabs = computed(() => {
  const availableTabs = [];

  if (configSchema() !== null) {
    availableTabs.push({
      value: "config",
      label: "Config",
      schema: configSchema()!,
      getValue: configGetValue,
      onUpdate: configOnUpdate,
    });
  }

  if (sceneSchema() !== null) {
    availableTabs.push({
      value: "scene",
      label: "Scene",
      schema: sceneSchema()!,
      getValue: sceneGetValue,
      onUpdate: sceneOnUpdate,
    });
  }

  return availableTabs;
});

const hasMultipleTabs = computed(() => tabs.value.length > 1);
const hasAnyConfig = computed(() => tabs.value.length > 0);

const handleToggle = () => {
  togglePanel("config");
};

const handleOpenChange = (open: boolean) => {
  if (!open) {
    closePanel();
  }
};
</script>

<template>
  <div class="config-panel">
    <Button
      variant="ghost"
      size="icon"
      class="config-panel__trigger fixed right-4 top-4 z-40 opacity-0 hover:opacity-100 hover:bg-black/70 transition-opacity"
      @click="handleToggle"
    >
      <Settings class="h-5 w-5 text-white" />
    </Button>

    <Sheet :open="isConfigOpen" side="right" @update:open="handleOpenChange">
      <div class="config-panel__content flex flex-col gap-6">
        <div v-if="hasAnyConfig" class="config-panel__options flex-1 min-h-0">
          <!-- Show tabs when multiple configs exist -->
          <Tabs v-if="hasMultipleTabs" :default-value="tabs[0].value" class="h-full">
            <TabsList>
              <TabsTrigger v-for="tab in tabs" :key="tab.value" :value="tab.value">
                {{ tab.label }}
              </TabsTrigger>
            </TabsList>

            <TabsContent v-for="tab in tabs" :key="tab.value" :value="tab.value">
              <SchemaControls
                :schema="tab.schema"
                :get-value="tab.getValue"
                :on-update="tab.onUpdate"
              />
            </TabsContent>
          </Tabs>

          <!-- Show single config without tabs -->
          <SchemaControls
            v-else
            :schema="tabs[0].schema"
            :get-value="tabs[0].getValue"
            :on-update="tabs[0].onUpdate"
          />
        </div>
        <p v-else class="text-sm text-muted-foreground">
          No configuration available for this view.
        </p>
      </div>
    </Sheet>
  </div>
</template>

<style scoped>
.config-panel__content {
  height: 100%;
}
</style>
