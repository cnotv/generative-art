<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import GenericPanel from "./GenericPanel.vue";
import { useViewConfigStore } from "@/stores/viewConfig";
import { useSceneConfigStore } from "@/stores/sceneConfig";
import SchemaControls from "./ConfigControls.vue";

const route = useRoute();
const viewStore = useViewConfigStore();
const sceneStore = useSceneConfigStore();

const routeName = computed(() => route.name as string);
const currentEntry = computed(() => {
  void viewStore.version;
  return viewStore.registry[routeName.value] ?? null;
});
const currentSchema = computed(() => currentEntry.value?.schema ?? null);
const hasViewConfig = computed(() => currentSchema.value !== null);

const getConfigValue = (path: string): unknown =>
  viewStore.getConfigValue(routeName.value, path);

const updateConfig = (path: string, value: unknown) =>
  viewStore.updateConfig(routeName.value, path, value);

const invokeCallback = (name: string) =>
  viewStore.invokeCallback(routeName.value, name);
</script>

<template>
  <GenericPanel panel-type="config" side="right" title="Config">
    <SchemaControls
      v-if="hasViewConfig"
      :schema="currentSchema!"
      :get-value="getConfigValue"
      :on-update="updateConfig"
      :on-action="invokeCallback"
    />
    <div id="config-panel-extra"></div>
    <SchemaControls
      :schema="sceneStore.schema"
      :get-value="sceneStore.getValue"
      :on-update="sceneStore.updateValue"
    />
  </GenericPanel>
</template>
