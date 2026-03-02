<script setup lang="ts">
import GenericPanel from "./GenericPanel.vue";
import { useViewConfig } from "@/composables/useViewConfig";
import {
  globalSceneSchema,
  getGlobalSceneValue,
  updateGlobalSceneConfig,
} from "./useGlobalSceneConfig";
import SchemaControls from "./ConfigControls.vue";
import { computed } from "vue";
import type { ConfigControlsSchema } from "@/composables/useViewConfig";

const viewConfig = useViewConfig();

const SCENE_PANEL_KEYS = ['global', 'orbit', 'postprocessing'];

const activeSchema = computed((): ConfigControlsSchema => {
  const raw = viewConfig.currentSceneSchema.value ?? globalSceneSchema;
  return Object.fromEntries(
    Object.entries(raw).filter(([key]) => SCENE_PANEL_KEYS.includes(key))
  );
});

const getValue = computed(() =>
  viewConfig.hasSceneConfig.value
    ? viewConfig.getSceneConfigValue
    : getGlobalSceneValue
);

const onUpdate = computed(() =>
  viewConfig.hasSceneConfig.value
    ? viewConfig.updateSceneConfig
    : updateGlobalSceneConfig
);
</script>

<template>
  <GenericPanel panel-type="scene" side="right">
    <SchemaControls
      :schema="activeSchema"
      :get-value="getValue"
      :on-update="onUpdate"
    />
  </GenericPanel>
</template>
