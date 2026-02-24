<script setup lang="ts">
import GenericPanel from "./GenericPanel.vue";
import { useViewConfig } from "@/composables/useViewConfig";
import SchemaControls from "./ConfigControls.vue";
import { computed } from "vue";
import type { ConfigControlsSchema } from "@/composables/useViewConfig";

const viewConfig = useViewConfig();

const sceneSchemaWithoutCamera = computed((): ConfigControlsSchema | null => {
  const schema = viewConfig.currentSceneSchema.value;
  if (!schema) return null;
  const entries = Object.entries(schema).filter(([key]) => key !== "camera");
  return entries.length > 0 ? Object.fromEntries(entries) : null;
});
</script>

<template>
  <GenericPanel panel-type="scene" side="right">
    <div class="scene-panel__content flex flex-col gap-1">
      <div v-if="sceneSchemaWithoutCamera" class="flex-1 min-h-0">
        <SchemaControls
          :schema="sceneSchemaWithoutCamera"
          :get-value="viewConfig.getSceneConfigValue"
          :on-update="viewConfig.updateSceneConfig"
        />
      </div>
      <p v-else class="text-sm text-muted-foreground">
        No scene configuration available for this view.
      </p>
    </div>
  </GenericPanel>
</template>

<style scoped>
.scene-panel__content {
  height: 100%;
}
</style>
