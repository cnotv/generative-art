<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import GenericPanel from "./GenericPanel.vue";
import { useViewConfigStore } from "@/stores/viewConfig";
import SchemaControls from "./ConfigControls.vue";

const route = useRoute();
const store = useViewConfigStore();

const routeName = computed(() => route.name as string);
const currentEntry = computed(() => {
  void store.version;
  return store.registry[routeName.value] ?? null;
});
const currentSchema = computed(() => currentEntry.value?.schema ?? null);
const hasConfig = computed(() => currentSchema.value !== null);

const getConfigValue = (path: string): unknown =>
  store.getConfigValue(routeName.value, path);

const updateConfig = (path: string, value: unknown) =>
  store.updateConfig(routeName.value, path, value);

const invokeCallback = (name: string) =>
  store.invokeCallback(routeName.value, name);
</script>

<template>
  <GenericPanel panel-type="config" side="right">
    <SchemaControls
      v-if="hasConfig"
      :schema="currentSchema!"
      :get-value="getConfigValue"
      :on-update="updateConfig"
      :on-action="invokeCallback"
    />
    <p v-else class="text-sm text-muted-foreground">
      No configuration available for this view.
    </p>
    <div id="config-panel-extra"></div>
  </GenericPanel>
</template>
