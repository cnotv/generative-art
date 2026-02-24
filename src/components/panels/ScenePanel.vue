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
    <SchemaControls
      v-if="sceneSchemaWithoutCamera"
      :schema="sceneSchemaWithoutCamera"
      :get-value="viewConfig.getSceneConfigValue"
      :on-update="viewConfig.updateSceneConfig"
    />
    <p v-else class="text-sm text-muted-foreground">
      No scene configuration available for this view.
    </p>
  </GenericPanel>
</template>
